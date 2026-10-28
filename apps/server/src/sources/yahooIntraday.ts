// Yahoo Finance 비공식 chart·spark API로 받는 장중 스냅숏(D-094, research/market-data.md).
// 지수 월물은 chart(세션 누적 고가·저가·거래량, 시가는 세션 첫 5분봉), 나머지 커브 월물은 spark(20개씩, 현재가만).
// 응답 형식이 바뀌면 zod 검증이 던져 배치가 실패한다.
import { z } from 'zod';
import { parseContractSymbol } from '../calc/contractSymbol.ts';
import type { IntradayQuote, IntradaySource } from './intraday.ts';

const BASE_URL = 'https://query1.finance.yahoo.com';
// spark 한 번에 받을 수 있는 심볼 수(넘으면 400)
export const SPARK_BATCH = 20;
// 비공식 API라 연속 호출 사이를 조금 띄운다
export const MIN_CALL_INTERVAL_MS = 300;
export const REQUEST_TIMEOUT_MS = 15_000;
// 기본 UA(node)는 막히는 일이 있어 브라우저 UA를 쓴다
const USER_AGENT = 'Mozilla/5.0';

const EXCHANGE = { CL: 'NYM', NG: 'NYM', GC: 'CMX', SI: 'CMX' } as const;

// 표준 심볼 → Yahoo 심볼(CLZ26 → CLZ26.NYM, D-049)
export function toYahooSymbol(symbol: string): string {
  return `${symbol}.${EXCHANGE[parseContractSymbol(symbol).commodityCode]}`;
}

const nullableNumbers = z.array(z.number().nullable());

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            symbol: z.string(),
            regularMarketPrice: z.number(),
            regularMarketTime: z.number(),
            regularMarketDayHigh: z.number().nullish(),
            regularMarketDayLow: z.number().nullish(),
            regularMarketVolume: z.number().nullish(),
            priceHint: z.number().int().min(0).max(8).optional(),
          }),
          // 봉이 없으면 timestamp·quote 값이 빠진다
          timestamp: z.array(z.number()).default([]),
          indicators: z.object({
            quote: z.array(z.object({ open: nullableNumbers.default([]) })),
          }),
        }),
      )
      .length(1),
  }),
});

// 그날 체결이 없는 월물은 close가 null이고 timestamp가 빈 배열이다
const sparkSchema = z.record(
  z.string(),
  z.object({
    timestamp: z.array(z.number()).nullish(),
    close: nullableNumbers.nullish(),
  }),
);

export type YahooDeps = {
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  log?: (message: string) => void;
};

export function createYahooIntradaySource({
  fetchFn = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
  log = console.log,
}: YahooDeps = {}): IntradaySource {
  let lastCallAt = -Infinity;

  // 404(만기·없는 심볼)는 null
  async function get(path: string, params: URLSearchParams): Promise<unknown> {
    const wait = lastCallAt + MIN_CALL_INTERVAL_MS - now();
    if (wait > 0) await sleep(wait);
    lastCallAt = now();
    const response = await fetchFn(`${BASE_URL}${path}?${params}`, {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`Yahoo ${path}: HTTP ${response.status}`);
    return response.json();
  }

  async function sessionQuote(symbol: string, sessionOpenAt: Date): Promise<IntradayQuote | null> {
    const period1 = Math.floor(sessionOpenAt.getTime() / 1000);
    const params = new URLSearchParams({
      interval: '5m',
      period1: String(period1),
      period2: String(Math.floor(now() / 1000)),
    });
    const body = await get(
      `/v8/finance/chart/${encodeURIComponent(toYahooSymbol(symbol))}`,
      params,
    );
    if (body === null) {
      log(`[yahoo] no chart for ${symbol}`);
      return null;
    }
    const [result] = chartSchema.parse(body).chart.result;
    const { meta } = result;
    const sourceTime = new Date(meta.regularMarketTime * 1000);
    // 세션에 아직 체결이 없으면 meta 고가·저가·거래량은 지난 세션 값이다. 현재가만 쓴다
    if (meta.regularMarketTime < period1) {
      return {
        contractSymbol: symbol,
        last: meta.regularMarketPrice,
        dayOpen: null,
        dayHigh: null,
        dayLow: null,
        volume: null,
        sourceTime,
      };
    }
    // 시가: 세션 시작 이후 첫 5분봉 시가(정비 시간 봉은 null). 봉 값은 float32라 가격 자릿수(priceHint)로 반올림한다
    const opens = result.indicators.quote[0]?.open ?? [];
    const open = result.timestamp.find((t, i) => t >= period1 && opens[i] != null);
    const rawOpen = open === undefined ? null : opens[result.timestamp.indexOf(open)];
    const dayOpen =
      rawOpen == null || meta.priceHint === undefined
        ? rawOpen
        : Number(rawOpen.toFixed(meta.priceHint));
    return {
      contractSymbol: symbol,
      last: meta.regularMarketPrice,
      dayOpen: dayOpen ?? null,
      dayHigh: meta.regularMarketDayHigh ?? null,
      dayLow: meta.regularMarketDayLow ?? null,
      volume: meta.regularMarketVolume ?? null,
      sourceTime,
    };
  }

  return {
    name: 'YAHOO',
    async fetchSessionQuotes(symbols, sessionOpenAt) {
      const quotes: IntradayQuote[] = [];
      for (const symbol of symbols) {
        const quote = await sessionQuote(symbol, sessionOpenAt);
        if (quote) quotes.push(quote);
      }
      return quotes;
    },
    async fetchLastPrices(symbols) {
      const quotes: IntradayQuote[] = [];
      const missing: string[] = [];
      for (let i = 0; i < symbols.length; i += SPARK_BATCH) {
        const batch = symbols.slice(i, i + SPARK_BATCH);
        const bySymbol = new Map(batch.map((s) => [toYahooSymbol(s), s]));
        const params = new URLSearchParams({
          symbols: [...bySymbol.keys()].join(','),
          range: '1d',
          interval: '5m',
        });
        const body = await get('/v8/finance/spark', params);
        // 없는 심볼은 결과에서 빠질 뿐이다. 모두 없으면 404가 온다
        const results = body === null ? {} : sparkSchema.parse(body);
        for (const [yahooSymbol, symbol] of bySymbol) {
          const close = results[yahooSymbol]?.close ?? [];
          // 마지막 null 아닌 종가. 없으면(체결 없음·없는 심볼) 빠지고 표시는 직전 정산가로 대신한다(D-085)
          const last = close.findLastIndex((c) => c !== null);
          if (last < 0) {
            missing.push(symbol);
            continue;
          }
          const time = results[yahooSymbol]?.timestamp?.[last];
          quotes.push({
            contractSymbol: symbol,
            last: close[last]!,
            dayOpen: null,
            dayHigh: null,
            dayLow: null,
            volume: null,
            sourceTime: time === undefined ? null : new Date(time * 1000),
          });
        }
      }
      // 먼 월물은 체결 없는 날이 흔해 한 줄로 남긴다
      if (missing.length > 0) log(`[yahoo] no spark price for ${missing.join(', ')}`);
      return quotes;
    },
  };
}

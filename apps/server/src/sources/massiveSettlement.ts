// Massive(구 Polygon) 선물 REST로 받는 일일 정산 실소스(D-012, D-071, D-095).
// Basic 요금제는 분당 5회라 호출 사이를 띄운다. 월물마다 한 번에 여러 거래일 봉을 받아 따라잡기·정정 확인에 다시 쓴다.
import type { CommodityCode } from '@futureetp/shared';
import { z } from 'zod';
import { MONTH_CODES, toContractSymbol } from '../calc/contractSymbol.ts';
import type { ContractDefinition, SettlementSource, SourceBar } from './settlement.ts';

const BASE_URL = 'https://api.massive.com';
export const MIN_CALL_INTERVAL_MS = 13_000;
export const RATE_LIMIT_WAIT_MS = 60_000;
const MAX_ATTEMPTS = 3;
// 월물마다 받는 최근 거래일 봉 수: 따라잡기 5거래일 + 정정 확인 1일 + 여유
const SESSION_LIMIT = 10;
// 받은 봉을 다시 쓰는 시간. 정산 작업 한 번(약 21분)과 이어지는 정정 확인을 덮는다
export const BAR_CACHE_TTL_MS = 60 * 60_000;

const contractsSchema = z.object({
  results: z.array(
    z.object({
      ticker: z.string(),
      first_trade_date: z.iso.date().nullish(),
      last_trade_date: z.iso.date(),
    }),
  ),
  next_url: z.string().optional(),
});

const sessionBarSchema = z.object({
  session_end_date: z.iso.date(),
  open: z.number().nullish(),
  high: z.number().nullish(),
  low: z.number().nullish(),
  volume: z.number(),
  // 진행 중인 세션 봉은 정산가가 없다
  settlement_price: z.number().nullish(),
});
type SessionBar = z.infer<typeof sessionBarSchema>;

// 거래가 없는 월물은 빈 배열이고 results가 빠지기도 한다
const aggsSchema = z.object({ results: z.array(sessionBarSchema).default([]) });

const monthIndex = (year: number, month: number) => year * 12 + month - 1;

// Massive 티커(Globex 심볼) → 표준 심볼(D-049). 연도는 CL·GC·SI가 2029년물까지 1자리(CLZ6), 그 뒤와 NG는 2자리(NGF27).
// 1자리 연도는 최종 거래일 연도 앞뒤에서 끝자리가 같은 해로 푼다. 인도월은 최종 거래일 달부터 2개월 안이다
export function parseMassiveTicker(
  code: CommodityCode,
  ticker: string,
  lastTradeDate: string,
): string {
  const match = new RegExp(`^${code}([${MONTH_CODES.join('')}])(\\d{1,2})$`).exec(ticker);
  if (!match) throw new Error(`Massive: unexpected ${code} ticker ${ticker}`);
  const [, monthCode, digits] = match;
  const month = MONTH_CODES.indexOf(monthCode as (typeof MONTH_CODES)[number]) + 1;
  const ltdYear = Number(lastTradeDate.slice(0, 4));
  const ltdMonth = Number(lastTradeDate.slice(5, 7));
  const year =
    digits.length === 2
      ? 2000 + Number(digits)
      : [ltdYear - 1, ltdYear, ltdYear + 1].find((y) => y % 10 === Number(digits));
  const offset = year === undefined ? -1 : monthIndex(year, month) - monthIndex(ltdYear, ltdMonth);
  if (year === undefined || offset < 0 || offset > 2) {
    throw new Error(`Massive: ${ticker} does not match last trade date ${lastTradeDate}`);
  }
  return `${year}-${String(month).padStart(2, '0')}`;
}

export type MassiveDeps = {
  apiKey: string | undefined;
  fetchFn?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
};

export function createMassiveSettlementSource({
  apiKey,
  fetchFn = fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = Date.now,
}: MassiveDeps): SettlementSource {
  let lastCallAt = -Infinity;
  // 표준 심볼 → Massive 티커
  const tickers = new Map<string, string>();
  const barCache = new Map<string, { fetchedAt: number; bars: SessionBar[] }>();

  async function get(url: string): Promise<unknown> {
    if (!apiKey) throw new Error('MASSIVE_API_KEY is not set');
    for (let attempt = 1; ; attempt++) {
      const wait = lastCallAt + MIN_CALL_INTERVAL_MS - now();
      if (wait > 0) await sleep(wait);
      lastCallAt = now();
      const response = await fetchFn(url, { headers: { authorization: `Bearer ${apiKey}` } });
      if (response.status === 429 && attempt < MAX_ATTEMPTS) {
        await sleep(RATE_LIMIT_WAIT_MS);
        continue;
      }
      const path = url.slice(BASE_URL.length).split('?')[0];
      if (!response.ok) {
        throw new Error(`Massive ${path}: HTTP ${response.status} ${await response.text()}`);
      }
      return response.json();
    }
  }

  // 그날 기준 월물 정의 전부(만기 지난 월물 포함). 티커 표를 채운다
  async function loadContracts(code: CommodityCode, tradeDate: string) {
    const params = new URLSearchParams({
      product_code: code,
      date: tradeDate,
      type: 'single',
      limit: '1000',
    });
    let url: string | undefined = `${BASE_URL}/futures/v1/contracts?${params}`;
    const contracts: (ContractDefinition & { ticker: string })[] = [];
    while (url) {
      const body = contractsSchema.parse(await get(url));
      for (const c of body.results) {
        const contractMonth = parseMassiveTicker(code, c.ticker, c.last_trade_date);
        const symbol = toContractSymbol(code, contractMonth);
        tickers.set(symbol, c.ticker);
        contracts.push({
          symbol,
          contractMonth,
          firstTradeDate: c.first_trade_date ?? null,
          lastTradeDate: c.last_trade_date,
          ticker: c.ticker,
        });
      }
      url = body.next_url?.startsWith(BASE_URL) ? body.next_url : undefined;
    }
    return contracts;
  }

  // 받아 둔 봉에 그날 이후 정산가가 있으면 그날 값은 확정이라 다시 받지 않는다
  async function sessionBars(ticker: string, tradeDate: string): Promise<SessionBar[]> {
    const cached = barCache.get(ticker);
    if (
      cached &&
      now() - cached.fetchedAt < BAR_CACHE_TTL_MS &&
      cached.bars.some((b) => b.session_end_date >= tradeDate && b.settlement_price != null)
    ) {
      return cached.bars;
    }
    const params = new URLSearchParams({ resolution: '1session', limit: String(SESSION_LIMIT) });
    const body = aggsSchema.parse(
      await get(`${BASE_URL}/futures/v1/aggs/${encodeURIComponent(ticker)}?${params}`),
    );
    barCache.set(ticker, { fetchedAt: now(), bars: body.results });
    return body.results;
  }

  return {
    name: 'MASSIVE',
    async listContracts(code, tradeDate) {
      const contracts = await loadContracts(code, tradeDate);
      return contracts
        .filter(
          (c) =>
            c.lastTradeDate >= tradeDate &&
            (c.firstTradeDate === null || c.firstTradeDate <= tradeDate),
        )
        .map((c) => ({
          symbol: c.symbol,
          contractMonth: c.contractMonth,
          firstTradeDate: c.firstTradeDate,
          lastTradeDate: c.lastTradeDate,
        }));
    },
    async fetchDailyBars(code, symbols, tradeDate) {
      if (symbols.some((s) => !tickers.has(s))) await loadContracts(code, tradeDate);
      const bars: SourceBar[] = [];
      for (const symbol of symbols) {
        const ticker = tickers.get(symbol);
        if (!ticker) throw new Error(`Massive: no ticker for ${symbol}`);
        // 거래가 없던 날은 봉이 없고, 반영 전이면 정산가가 없다. 둘 다 빠진다(D-095)
        const bar = (await sessionBars(ticker, tradeDate)).find(
          (b) => b.session_end_date === tradeDate,
        );
        if (bar?.settlement_price == null) continue;
        bars.push({
          contractSymbol: symbol,
          open: bar.open ?? null,
          high: bar.high ?? null,
          low: bar.low ?? null,
          settle: bar.settlement_price,
          volume: bar.volume,
        });
      }
      return bars;
    },
  };
}

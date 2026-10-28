// 미국 ETP 상장일과 일별 거래대금(D-017, D-099). Yahoo chart는 crumb 없이 받는다(quoteSummary는 crumb이 필요해 쓰지 않는다).
// 상장일은 meta.firstTradeDate(거래소 시간대 날짜), 거래대금은 일봉 종가 × 거래량이다.
import { z } from 'zod';
import { USER_AGENT } from './yahooIntraday.ts';

const BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';
export const REQUEST_TIMEOUT_MS = 15_000;
// 평균 20거래일보다 넉넉하게
const RANGE = '2mo';

const nullableNumbers = z.array(z.number().nullable());

const chartSchema = z.object({
  chart: z.object({
    result: z
      .array(
        z.object({
          meta: z.object({
            firstTradeDate: z.number().nullish(),
            exchangeTimezoneName: z.string(),
          }),
          timestamp: z.array(z.number()).default([]),
          indicators: z.object({
            quote: z
              .array(
                z.object({
                  close: nullableNumbers.default([]),
                  volume: nullableNumbers.default([]),
                }),
              )
              .length(1),
          }),
        }),
      )
      .length(1),
  }),
});

export type YahooEtpDaily = {
  listedDate: string | null;
  // 오래된 날부터. 종가·거래량 중 하나라도 빠진 날은 뺀다
  tradingValues: number[];
};

export interface YahooEtpSource {
  daily(symbol: string): Promise<YahooEtpDaily>;
}

const dateIn = (timeZone: string, epochSeconds: number) =>
  new Intl.DateTimeFormat('en-CA', { timeZone }).format(new Date(epochSeconds * 1000));

export function createYahooEtpSource({
  fetchFn = fetch,
}: { fetchFn?: typeof fetch } = {}): YahooEtpSource {
  return {
    async daily(symbol) {
      const params = new URLSearchParams({ range: RANGE, interval: '1d' });
      const response = await fetchFn(`${BASE_URL}/${encodeURIComponent(symbol)}?${params}`, {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Yahoo ${symbol}: HTTP ${response.status}`);
      const [result] = chartSchema.parse(await response.json()).chart.result;
      const { meta, timestamp } = result;
      const [{ close, volume }] = result.indicators.quote;
      const tradingValues = timestamp.flatMap((_, i) => {
        const price = close[i];
        const shares = volume[i];
        return price == null || shares == null ? [] : [price * shares];
      });
      return {
        listedDate:
          meta.firstTradeDate == null
            ? null
            : dateIn(meta.exchangeTimezoneName, meta.firstTradeDate),
        tradingValues,
      };
    },
  };
}

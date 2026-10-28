import { z } from 'zod';
import { COMMODITY_CODES, ETP_MARKETS, ETP_TYPES, FX_HEDGES, LOCALES } from './domain.ts';

// C-d 목록 행. 매핑 전 후보·상장폐지 상품은 빠진다(data-model.md 4. ETP)
export const etpSummarySchema = z.object({
  id: z.uuid(),
  market: z.enum(ETP_MARKETS),
  type: z.enum(ETP_TYPES),
  // 예: 1, 2, -1, -2
  leverage: z.number(),
  fxHedge: z.enum(FX_HEDGES),
  // 원문
  name: z.string(),
  // 상장 중 시리즈 종목코드(ETN 후속 시리즈가 겹치면 여럿)
  tickers: z.array(z.string()),
  // 통화는 market으로 정해진다(KRX 원, US 달러). 아직 못 받았으면 null(D-017)
  aum: z.number().nullable(),
  avgTradingValue: z.number().nullable(),
});
export type EtpSummary = z.infer<typeof etpSummarySchema>;

// GET /v1/commodities/:code/etps. 필터·정렬은 앱에서 한다
export const etpListSchema = z.object({
  // 상품 정보를 마지막으로 받은 시각. 상품이 없으면 null
  asOf: z.iso.datetime().nullable(),
  etps: z.array(etpSummarySchema),
});
export type EtpList = z.infer<typeof etpListSchema>;

// C-d-a 시리즈 줄
export const etpSeriesSchema = z.object({
  ticker: z.string(),
  // ETN A/B..., ETF는 null
  seriesCode: z.string().nullable(),
  maturityDate: z.iso.date().nullable(),
});
export type EtpSeries = z.infer<typeof etpSeriesSchema>;

// GET /v1/etps/:id(C-d-a). 자동 수집 정보라 원문 언어 그대로다
export const etpDetailSchema = etpSummarySchema.extend({
  commodityCode: z.enum(COMMODITY_CODES),
  nameLang: z.enum(LOCALES),
  issuer: z.string().nullable(),
  underlyingIndex: z.string().nullable(),
  // 총보수 %
  expenseRatio: z.number().nullable(),
  issuerUrl: z.string().nullable(),
  // 첫 시리즈 상장일. 모르면 null
  listedDate: z.iso.date().nullable(),
  // 상장 중 시리즈만
  series: z.array(etpSeriesSchema),
  collectedAt: z.iso.datetime(),
});
export type EtpDetail = z.infer<typeof etpDetailSchema>;

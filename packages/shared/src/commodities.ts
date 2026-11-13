import { z } from 'zod';
import { COMMODITY_CODES } from './domain.ts';
import { freshnessSchema } from './freshness.ts';

// A 원자재 목록 한 줄(월물 하나, product.md 월물 목록, D-085). 가격은 소수 자릿수를 맞추지 않은 값이다.
export const contractQuoteSchema = z.object({
  symbol: z.string(),
  // YYYY-MM
  contractMonth: z.string().regex(/^\d{4}-\d{2}$/),
  // 거래일 정산가 → 장중 스냅숏 → 마지막 정산가("거래 없음", 직전 거래일 또는 그 전) 순. 일봉이 하나도 없으면 null
  price: z.number().nullable(),
  // 직전 거래일 정산가 대비. 거래 없음이거나 직전 정산가가 없으면 null
  change: z.number().nullable(),
  changePct: z.number().nullable(),
  noTrade: z.boolean(),
  isFront: z.boolean(),
});
export type ContractQuote = z.infer<typeof contractQuoteSchema>;

export const commoditySummarySchema = z.object({
  code: z.enum(COMMODITY_CODES),
  priceDecimals: z.number().int().nonnegative(),
  // 알림 대상(B-a) 원자재
  alert: z.boolean(),
  // 만기순 5개, 대표월물이 그 안에 없으면 6번째
  contracts: z.array(contractQuoteSchema),
});
export type CommoditySummary = z.infer<typeof commoditySummarySchema>;

// GET /v1/commodities. 원자재는 표시 순서대로다.
export const commoditiesSchema = z.object({
  freshness: freshnessSchema,
  commodities: z.array(commoditySummarySchema),
});
export type Commodities = z.infer<typeof commoditiesSchema>;

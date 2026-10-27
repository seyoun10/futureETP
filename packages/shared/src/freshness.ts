import { z } from 'zod';
import { MARKET_STATES } from './domain.ts';

// A·C 조회 응답 data의 기준 정보(architecture.md freshness, D-042, D-048). 시각은 UTC ISO 8601이다.
export const freshnessSchema = z.object({
  asOf: z.iso.datetime(),
  tradeDate: z.iso.date(),
  delayed: z.boolean(),
  marketState: z.enum(MARKET_STATES),
  nextUpdateAt: z.iso.datetime().nullable(),
});
export type Freshness = z.infer<typeof freshnessSchema>;

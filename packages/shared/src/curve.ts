import { z } from 'zod';
import { CURVE_STATES } from './domain.ts';
import { freshnessSchema } from './freshness.ts';

// C-b 월물 하나(product.md 커브). 가격은 소수 자릿수를 맞추지 않은 값이다.
export const curveContractSchema = z.object({
  symbol: z.string(),
  // YYYY-MM
  contractMonth: z.string().regex(/^\d{4}-\d{2}$/),
  // 그 커브에 없으면 null(기준일에만 있는 월물 = 그 사이 만기, D에만 있는 월물 = 신규 상장 등)
  basePrice: z.number().nullable(),
  currentPrice: z.number().nullable(),
  // 두 커브에 모두 있고 기준일 값이 0보다 클 때만
  changePct: z.number().nullable(),
});
export type CurveContract = z.infer<typeof curveContractSchema>;

// M1→M2 수치 요약. M1·M2가 없거나 가격이 0 이하면 null(화면은 "산출 불가")
export const curveStatsSchema = z.object({
  m1ContractMonth: z.string().regex(/^\d{4}-\d{2}$/),
  m2ContractMonth: z.string().regex(/^\d{4}-\d{2}$/),
  state: z.enum(CURVE_STATES),
  // (M2 / M1 − 1) × 100
  spreadPct: z.number(),
  // 연환산 롤 수익률(%/년). 양수 = 백워데이션(롤 이익)
  rollYieldPct: z.number(),
});
export type CurveStats = z.infer<typeof curveStatsSchema>;

// GET /v1/commodities/:code/curve?baseDate
export const curveSchema = z.object({
  freshness: freshnessSchema,
  priceDecimals: z.number().int().nonnegative(),
  // D = freshness.tradeDate
  // 실제로 쓴 기준일(거래일). 요청한 날짜가 휴장일이면 직전 거래일, 하한보다 앞이면 하한 이후 첫 거래일이다
  baseDate: z.iso.date(),
  // D부터 센 거래일 수(기준일이 D-1이면 1)
  baseOffset: z.number().int().positive(),
  // 기준일을 1 거래일 앞·뒤로 옮긴 날짜. 범위 끝이면 null
  prevBaseDate: z.iso.date().nullable(),
  nextBaseDate: z.iso.date().nullable(),
  // 기준일 선택 범위: 그 원자재의 가장 이른 일봉 날짜 ~ D-1
  minBaseDate: z.iso.date(),
  maxBaseDate: z.iso.date(),
  // 비교 커브 날짜 = 기준일 다음 거래일(기준일이 D-1이면 D, D-114). current* 값은 이 날짜 기준이다
  compareDate: z.iso.date(),
  // 만기순
  points: z.array(curveContractSchema),
  current: curveStatsSchema.nullable(),
  base: curveStatsSchema.nullable(),
});
export type Curve = z.infer<typeof curveSchema>;

import { z } from 'zod';
import { BASES, DIRECTIONS, MA_PERIODS, WINDOWS } from './domain.ts';
import { freshnessSchema } from './freshness.ts';

// C-a 지수 일봉 하나(product.md 이격도차트, D-086). 가격은 맞춤 비율을 곱해 표시 자릿수+2로, 이격도(%)는 3자리로 반올림한 값이다(D-046).
export const disparityBarSchema = z.object({
  tradeDate: z.iso.date(),
  // 산출 불가일은 모두 null
  open: z.number().nullable(),
  high: z.number().nullable(),
  low: z.number().nullable(),
  close: z.number().nullable(),
  // 초기 (이평선 기간−1)일과 산출 불가일은 null
  ma: z.number().nullable(),
  disparity: z.number().nullable(),
  // 한국형·미국형 롤 음영, 대표월물은 전환일
  inRoll: z.boolean(),
  // 그날 보유 월물(전 거래일 종가 뒤 비중, 합 1). 만기순. 첫날은 빈 배열
  holdings: z.array(
    z.object({ contractMonth: z.string().regex(/^\d{4}-\d{2}$/), weight: z.number() }),
  ),
});
export type DisparityBar = z.infer<typeof disparityBarSchema>;

// rare 레벨 하나의 이격도와 오늘 rare-level 선 가격. 이평선이 없으면 price는 null
export const rareLevelLineSchema = z.object({
  direction: z.enum(DIRECTIONS),
  level: z.number(),
  disparity: z.number(),
  price: z.number().nullable(),
});
export type RareLevelLine = z.infer<typeof rareLevelLineSchema>;

// GET /v1/commodities/:code/disparity
export const disparityChartSchema = z.object({
  freshness: freshnessSchema,
  priceDecimals: z.number().int().nonnegative(),
  // 실제로 그린 기준값. 요청한 한국형·미국형 규칙이 없는 원자재는 FRONT이고 fallback이 true다
  basis: z.enum(BASES),
  fallback: z.boolean(),
  maPeriod: z.literal(MA_PERIODS),
  window: z.enum(WINDOWS),
  // 분포가 없으면(데이터 부족) null
  distribution: z
    .object({ actualStartDate: z.iso.date(), sampleCount: z.number().int() })
    .nullable(),
  // 위 방향 레벨 오름차순, 그다음 아래 방향 레벨 오름차순. 분포가 없으면 빈 배열
  rareLevels: z.array(rareLevelLineSchema),
  // 마지막 봉 이격도의 가까운 꼬리 백분위
  currentTail: z.object({ side: z.enum(DIRECTIONS), pct: z.number() }).nullable(),
  // 마지막 봉이 장중 스냅숏으로 만든 오늘 잠정 봉인지
  provisional: z.boolean(),
  // 거래일 오름차순. 최근 3년씩 준다. before를 주면 그 날짜보다 이른 3년이다(D-104)
  bars: z.array(disparityBarSchema),
  // bars보다 이른 봉이 더 있는지
  hasMore: z.boolean(),
});
export type DisparityChart = z.infer<typeof disparityChartSchema>;

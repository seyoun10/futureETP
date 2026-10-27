import { BASES, COMMODITY_CODES, MA_PERIODS, rareLevelsSchema, WINDOWS } from '@futureetp/shared';
import type { Basis, CommodityCode, DisparityChart, MaPeriod, Window } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildDisparityChart } from '../calc/disparityChart.ts';
import type {
  StoredDisparity,
  StoredIndexBar,
  StoredIndexSnapshot,
  StoredWeight,
} from '../calc/disparityChart.ts';
import { marketStatus } from '../calc/marketState.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import type { CommoditiesStore } from './commodities.ts';
import { ApiException } from './errors.ts';
import { ok } from './response.ts';

export type DisparityStore = Pick<CommoditiesStore, 'tradingDays' | 'lastSettledTradeDate'> & {
  priceDecimals: (code: CommodityCode) => Promise<number | null>;
  hasRollRule: (code: CommodityCode, basis: Basis) => Promise<boolean>;
  // 아래는 모두 거래일 오름차순
  indexBars: (code: CommodityCode, basis: Basis) => Promise<StoredIndexBar[]>;
  disparities: (code: CommodityCode, basis: Basis, ma: MaPeriod) => Promise<StoredDisparity[]>;
  weights: (code: CommodityCode, basis: Basis) => Promise<StoredWeight[]>;
  scale: (code: CommodityCode, basis: Basis) => Promise<{ ratio: number; updatedAt: Date } | null>;
  // 그 거래일의 최근 스냅숏
  latestIndexSnapshot: (
    code: CommodityCode,
    basis: Basis,
    tradeDate: string,
  ) => Promise<StoredIndexSnapshot | null>;
  distribution: (
    code: CommodityCode,
    basis: Basis,
    ma: MaPeriod,
    window: Window,
  ) => Promise<{ actualStartDate: string; sampleCount: number; sortedValues: number[] } | null>;
};

export type DisparityQuery = {
  basis: Basis;
  ma: MaPeriod;
  window: Window;
  // 오름차순 5개
  levels: number[];
};

// 앱은 설정 값을 query로 보낸다(query key에 그대로 들어가 설정을 바꾸면 다시 조회된다, D-086)
const querySchema = z.object({
  basis: z.enum(BASES),
  ma: z.coerce.number().pipe(z.literal(MA_PERIODS)),
  window: z.enum(WINDOWS),
  levels: z
    .string()
    .transform((s) => s.split(',').map(Number))
    .pipe(rareLevelsSchema),
});

// 직전 거래일(휴장 연휴)과 다음 개장(nextUpdateAt)을 찾을 만큼 읽는다(commodities.ts와 같다)
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 10;

// GET /v1/commodities/:code/disparity(C-a, D-086)
export async function loadDisparityChart(
  store: DisparityStore,
  code: CommodityCode,
  query: DisparityQuery,
  now: Date,
): Promise<DisparityChart> {
  const today = now.toISOString().slice(0, 10);
  const [days, lastSettled, priceDecimals, hasRule] = await Promise.all([
    store.tradingDays(addDays(today, -LOOKBACK_DAYS), addDays(today, LOOKAHEAD_DAYS)),
    store.lastSettledTradeDate(),
    store.priceDecimals(code),
    query.basis === 'FRONT' ? Promise.resolve(true) : store.hasRollRule(code, query.basis),
  ]);
  if (priceDecimals === null) throw new ApiException('INTERNAL', `Commodity ${code} is missing`);
  const status = marketStatus(now, days, lastSettled);
  const tradeDate = status.tradeDate;
  if (tradeDate === null) throw new ApiException('INTERNAL', 'Trading calendar is missing');
  // 규칙이 없는 원자재는 대표월물로 대신 보여 준다(product.md 기준값이 없는 원자재)
  const basis: Basis = hasRule ? query.basis : 'FRONT';

  const [bars, disparities, weights, scale, snapshot, distribution] = await Promise.all([
    store.indexBars(code, basis),
    store.disparities(code, basis, query.ma),
    store.weights(code, basis),
    store.scale(code, basis),
    store.latestIndexSnapshot(code, basis, tradeDate),
    store.distribution(code, basis, query.ma, query.window),
  ]);
  const chart = buildDisparityChart({
    maPeriod: query.ma,
    levels: query.levels,
    bars,
    disparities,
    weights,
    ratio: scale?.ratio ?? null,
    snapshot,
    sortedValues: distribution?.sortedValues ?? null,
  });

  return {
    freshness: {
      // 잠정 봉이면 스냅숏 시각, 아니면 마지막 재계산 시각, 적재 전이면 조회 시각
      asOf: ((chart.provisional ? snapshot?.capturedAt : scale?.updatedAt) ?? now).toISOString(),
      tradeDate,
      delayed: chart.provisional,
      marketState: status.state,
      nextUpdateAt: status.nextUpdateAt?.toISOString() ?? null,
    },
    priceDecimals,
    basis,
    fallback: basis !== query.basis,
    maPeriod: query.ma,
    window: query.window,
    distribution:
      distribution === null
        ? null
        : {
            actualStartDate: distribution.actualStartDate,
            sampleCount: distribution.sampleCount,
          },
    ...chart,
  };
}

export function disparityRoutes(store: DisparityStore, now: () => Date) {
  const routes = new Hono();
  routes.get('/:code/disparity', async (c) => {
    const code = z.enum(COMMODITY_CODES).safeParse(c.req.param('code'));
    if (!code.success)
      throw new ApiException('NOT_FOUND', `Unknown commodity ${c.req.param('code')}`);
    const query = querySchema.safeParse(c.req.query());
    if (!query.success) throw new ApiException('VALIDATION_FAILED', z.prettifyError(query.error));
    return ok(c, await loadDisparityChart(store, code.data, query.data, now()));
  });
  return routes;
}

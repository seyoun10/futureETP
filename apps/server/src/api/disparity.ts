import { BASES, MA_PERIODS, rareLevelsSchema, WINDOWS } from '@futureetp/shared';
import type { Basis, CommodityCode, DisparityChart, MaPeriod, Window } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildDisparityChart, roundDisparityChart } from '../calc/disparityChart.ts';
import type {
  StoredDisparity,
  StoredIndexBar,
  StoredIndexSnapshot,
  StoredWeight,
} from '../calc/disparityChart.ts';
import type { RollRuleParams } from '../calc/rollWeight.ts';
import { beforeSchema, pageRange } from './chartPage.ts';
import { freshness, loadChartMarket } from './market.ts';
import type { ChartMarketStore } from './market.ts';
import { commodityCodeParam, parseInput } from './params.ts';
import { ok } from './response.ts';

export type DisparityStore = ChartMarketStore & {
  // 한국형·미국형 roll_rule.params. 없으면 null
  rollRule: (code: CommodityCode, basis: Exclude<Basis, 'FRONT'>) => Promise<RollRuleParams | null>;
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
  // 이 날짜보다 이른 봉만(이전 3년 더 받기). 없으면 최근 3년
  before?: string;
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
  before: beforeSchema,
});

// GET /v1/commodities/:code/disparity(C-a, D-086)
export async function loadDisparityChart(
  store: DisparityStore,
  code: CommodityCode,
  query: DisparityQuery,
  now: Date,
): Promise<DisparityChart> {
  const {
    status,
    tradeDate,
    priceDecimals,
    extra: rule,
  } = await loadChartMarket(
    store,
    code,
    now,
    query.basis === 'FRONT' ? Promise.resolve(null) : store.rollRule(code, query.basis),
  );
  // 규칙이 없는 원자재는 대표월물로 대신 보여 준다(product.md 기준값이 없는 원자재)
  const basis: Basis = rule === null ? 'FRONT' : query.basis;

  const [bars, disparities, weights, scale, snapshot, distribution] = await Promise.all([
    store.indexBars(code, basis),
    store.disparities(code, basis, query.ma),
    store.weights(code, basis),
    store.scale(code, basis),
    store.latestIndexSnapshot(code, basis, tradeDate),
    store.distribution(code, basis, query.ma, query.window),
  ]);
  const chart = roundDisparityChart(
    buildDisparityChart({
      maPeriod: query.ma,
      levels: query.levels,
      bars,
      disparities,
      weights,
      ratio: scale?.ratio ?? null,
      snapshot,
      rule: rule === null ? null : { commodityCode: code, params: rule },
      sortedValues: distribution?.sortedValues ?? null,
    }),
    priceDecimals,
  );

  // 전체를 계산한 뒤 자른다(이평선·보유 월물은 앞 봉에 기대고, 조회 비용은 작다)
  const page = pageRange(
    chart.bars.map((b) => b.tradeDate),
    query.before,
  );

  return {
    // 잠정 봉이면 스냅숏 시각, 아니면 마지막 재계산 시각, 적재 전이면 조회 시각
    freshness: freshness(
      status,
      tradeDate,
      chart.provisional ? snapshot?.capturedAt : scale?.updatedAt,
      chart.provisional,
      now,
    ),
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
    bars: chart.bars.slice(page.start, page.end),
    hasMore: page.hasMore,
  };
}

export function disparityRoutes(store: DisparityStore, now: () => Date) {
  const routes = new Hono();
  routes.get('/:code/disparity', async (c) => {
    const code = commodityCodeParam(c.req.param('code'));
    const query = parseInput(querySchema, c.req.query());
    return ok(c, await loadDisparityChart(store, code, query, now()));
  });
  return routes;
}

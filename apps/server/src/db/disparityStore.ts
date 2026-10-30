import { and, asc, desc, eq } from 'drizzle-orm';
import type { DisparityStore } from '../api/disparity.ts';
import { rollRuleParamsSchema } from '../calc/rollWeight.ts';
import type { db as Db } from './client.ts';
import { createCommoditiesStore } from './commoditiesStore.ts';
import {
  commodity,
  contract,
  disparity,
  disparityDistribution,
  indexBar,
  indexScale,
  indexSnapshot,
  rollRule,
  rollWeight,
} from './schema.ts';

// GET /v1/commodities/:code/disparity 조회(D-086). 조립은 api/disparity.ts·calc가 한다.
export function createDisparityStore(db: typeof Db): DisparityStore {
  const { tradingDays, lastSettledTradeDate } = createCommoditiesStore(db);
  return {
    tradingDays,
    lastSettledTradeDate,
    async priceDecimals(code) {
      const [row] = await db
        .select({ priceDecimals: commodity.priceDecimals })
        .from(commodity)
        .where(eq(commodity.code, code));
      return row?.priceDecimals ?? null;
    },
    async rollRule(code, basis) {
      const [row] = await db
        .select({ params: rollRule.params })
        .from(rollRule)
        .where(and(eq(rollRule.commodityCode, code), eq(rollRule.basis, basis)));
      return row === undefined ? null : rollRuleParamsSchema.parse(row.params);
    },
    indexBars: (code, basis) =>
      db
        .select({
          tradeDate: indexBar.tradeDate,
          open: indexBar.open,
          high: indexBar.high,
          low: indexBar.low,
          close: indexBar.close,
          inRollPeriod: indexBar.inRollPeriod,
        })
        .from(indexBar)
        .where(and(eq(indexBar.commodityCode, code), eq(indexBar.basis, basis)))
        .orderBy(asc(indexBar.tradeDate)),
    disparities: (code, basis, ma) =>
      db
        .select({
          tradeDate: disparity.tradeDate,
          ma: disparity.ma,
          disparity: disparity.disparity,
        })
        .from(disparity)
        .where(
          and(
            eq(disparity.commodityCode, code),
            eq(disparity.basis, basis),
            eq(disparity.maPeriod, ma),
          ),
        )
        .orderBy(asc(disparity.tradeDate)),
    weights: (code, basis) =>
      db
        .select({
          tradeDate: rollWeight.tradeDate,
          contractMonth: contract.contractMonth,
          weight: rollWeight.weight,
        })
        .from(rollWeight)
        .innerJoin(contract, eq(contract.symbol, rollWeight.contractSymbol))
        .where(and(eq(rollWeight.commodityCode, code), eq(rollWeight.basis, basis)))
        .orderBy(asc(rollWeight.tradeDate)),
    async scale(code, basis) {
      const [row] = await db
        .select({ ratio: indexScale.ratio, updatedAt: indexScale.updatedAt })
        .from(indexScale)
        .where(and(eq(indexScale.commodityCode, code), eq(indexScale.basis, basis)));
      return row ?? null;
    },
    async latestIndexSnapshot(code, basis, tradeDate) {
      const [row] = await db
        .select({
          tradeDate: indexSnapshot.tradeDate,
          capturedAt: indexSnapshot.capturedAt,
          open: indexSnapshot.open,
          high: indexSnapshot.high,
          low: indexSnapshot.low,
          last: indexSnapshot.last,
        })
        .from(indexSnapshot)
        .where(
          and(
            eq(indexSnapshot.commodityCode, code),
            eq(indexSnapshot.basis, basis),
            eq(indexSnapshot.tradeDate, tradeDate),
          ),
        )
        .orderBy(desc(indexSnapshot.capturedAt))
        .limit(1);
      return row ?? null;
    },
    async distribution(code, basis, ma, window) {
      const [row] = await db
        .select({
          actualStartDate: disparityDistribution.actualStartDate,
          sampleCount: disparityDistribution.sampleCount,
          sortedValues: disparityDistribution.sortedValues,
        })
        .from(disparityDistribution)
        .where(
          and(
            eq(disparityDistribution.commodityCode, code),
            eq(disparityDistribution.basis, basis),
            eq(disparityDistribution.maPeriod, ma),
            eq(disparityDistribution.window, window),
          ),
        );
      return row ?? null;
    },
  };
}

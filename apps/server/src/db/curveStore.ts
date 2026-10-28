import { and, asc, between, desc, eq, gte, inArray, lt, min } from 'drizzle-orm';
import type { CurveStore } from '../api/curve.ts';
import type { db as Db } from './client.ts';
import { createCommoditiesStore } from './commoditiesStore.ts';
import { createDisparityStore } from './disparityStore.ts';
import { contract, dailyBar, rollWeight, tradingDay } from './schema.ts';

// GET /v1/commodities/:code/curve 조회(D-046). 조립은 api/curve.ts·calc가 한다.
export function createCurveStore(db: typeof Db): CurveStore {
  const { tradingDays, lastSettledTradeDate, latestSnapshots } = createCommoditiesStore(db);
  const { priceDecimals } = createDisparityStore(db);
  return {
    tradingDays,
    lastSettledTradeDate,
    latestSnapshots,
    priceDecimals,
    async firstBarDate(code) {
      const [row] = await db
        .select({ tradeDate: min(dailyBar.tradeDate) })
        .from(dailyBar)
        .innerJoin(contract, eq(contract.symbol, dailyBar.contractSymbol))
        .where(eq(contract.commodityCode, code));
      return row?.tradeDate ?? null;
    },
    async tradeDates(from, to) {
      const rows = await db
        .select({ tradeDate: tradingDay.tradeDate })
        .from(tradingDay)
        .where(between(tradingDay.tradeDate, from, to))
        .orderBy(asc(tradingDay.tradeDate));
      return rows.map((r) => r.tradeDate);
    },
    contracts: (code, fromDate) =>
      db
        .select({
          symbol: contract.symbol,
          contractMonth: contract.contractMonth,
          lastTradeDate: contract.lastTradeDate,
          isTarget: contract.isTarget,
        })
        .from(contract)
        .where(and(eq(contract.commodityCode, code), gte(contract.lastTradeDate, fromDate))),
    async frontSymbol(code, before) {
      const [row] = await db
        .select({ contractSymbol: rollWeight.contractSymbol })
        .from(rollWeight)
        .where(
          and(
            eq(rollWeight.commodityCode, code),
            eq(rollWeight.basis, 'FRONT'),
            lt(rollWeight.tradeDate, before),
          ),
        )
        .orderBy(desc(rollWeight.tradeDate))
        .limit(1);
      return row?.contractSymbol ?? null;
    },
    async dailyBars(symbols, dates) {
      if (symbols.length === 0 || dates.length === 0) return [];
      return db
        .select({
          contractSymbol: dailyBar.contractSymbol,
          tradeDate: dailyBar.tradeDate,
          settle: dailyBar.settle,
          volume: dailyBar.volume,
          collectedAt: dailyBar.collectedAt,
          revisedAt: dailyBar.revisedAt,
        })
        .from(dailyBar)
        .where(and(inArray(dailyBar.contractSymbol, symbols), inArray(dailyBar.tradeDate, dates)));
    },
  };
}

import { and, asc, desc, eq, gte, inArray, lte, max } from 'drizzle-orm';
import type { CommoditiesStore } from '../api/commodities.ts';
import type { db as Db } from './client.ts';
import { commodity, contract, dailyBar, intradaySnapshot, rollWeight } from './schema.ts';
import { settleColumns, tradingDaysBetween } from './queries.ts';
import { lastSettledTradeDate } from './settle.ts';

// GET /v1/commodities 조회(D-085). 계산은 api/commodities.ts·calc가 한다.
export function createCommoditiesStore(db: typeof Db): CommoditiesStore {
  return {
    tradingDays: (from, to) => tradingDaysBetween(db, from, to),
    async lastSettledTradeDate() {
      const settled = await lastSettledTradeDate(db);
      if (settled !== null) return settled;
      const [row] = await db.select({ tradeDate: max(dailyBar.tradeDate) }).from(dailyBar);
      return row?.tradeDate ?? null;
    },
    commodities: () =>
      db
        .select({ code: commodity.code, priceDecimals: commodity.priceDecimals })
        .from(commodity)
        .orderBy(asc(commodity.sortOrder)),
    contracts: (tradeDate) =>
      db
        .select({
          commodityCode: contract.commodityCode,
          symbol: contract.symbol,
          contractMonth: contract.contractMonth,
          lastTradeDate: contract.lastTradeDate,
          isTarget: contract.isTarget,
        })
        .from(contract)
        .where(gte(contract.lastTradeDate, tradeDate)),
    frontSymbols: (tradeDate) =>
      db
        .selectDistinctOn([rollWeight.commodityCode], {
          commodityCode: rollWeight.commodityCode,
          contractSymbol: rollWeight.contractSymbol,
        })
        .from(rollWeight)
        .where(and(eq(rollWeight.basis, 'FRONT'), lte(rollWeight.tradeDate, tradeDate)))
        .orderBy(rollWeight.commodityCode, desc(rollWeight.tradeDate)),
    async dailyBars(symbols, dates) {
      if (symbols.length === 0) return [];
      return db
        .select(settleColumns)
        .from(dailyBar)
        .where(and(inArray(dailyBar.contractSymbol, symbols), inArray(dailyBar.tradeDate, dates)));
    },
    async latestSnapshots(symbols, tradeDate) {
      if (symbols.length === 0) return [];
      return db
        .selectDistinctOn([intradaySnapshot.contractSymbol], {
          contractSymbol: intradaySnapshot.contractSymbol,
          capturedAt: intradaySnapshot.capturedAt,
          last: intradaySnapshot.last,
        })
        .from(intradaySnapshot)
        .where(
          and(
            inArray(intradaySnapshot.contractSymbol, symbols),
            eq(intradaySnapshot.tradeDate, tradeDate),
          ),
        )
        .orderBy(intradaySnapshot.contractSymbol, desc(intradaySnapshot.capturedAt));
    },
  };
}

import { and, asc, desc, eq, gte, inArray, lt, lte, max, sql } from 'drizzle-orm';
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
    // 원자재마다 최근 FRONT 행 하나. 원자재별 LATERAL LIMIT 1이라 기본키 역방향으로 한 행만 읽는다
    frontSymbols(tradeDate) {
      const latest = db
        .select({ contractSymbol: rollWeight.contractSymbol })
        .from(rollWeight)
        .where(
          and(
            eq(rollWeight.commodityCode, commodity.code),
            eq(rollWeight.basis, 'FRONT'),
            lte(rollWeight.tradeDate, tradeDate),
          ),
        )
        .orderBy(desc(rollWeight.tradeDate))
        .limit(1)
        .as('latest');
      return db
        .select({ commodityCode: commodity.code, contractSymbol: latest.contractSymbol })
        .from(commodity)
        .innerJoinLateral(latest, sql`true`);
    },
    async dailyBars(symbols, dates) {
      if (symbols.length === 0) return [];
      return db
        .select(settleColumns)
        .from(dailyBar)
        .where(and(inArray(dailyBar.contractSymbol, symbols), inArray(dailyBar.tradeDate, dates)));
    },
    // 월물마다 tradeDate 전 마지막 봉 하나(월물별 LATERAL LIMIT 1, 전체 이력을 정렬하지 않음)
    async lastBarsBefore(symbols, tradeDate) {
      if (symbols.length === 0) return [];
      const last = db
        .select(settleColumns)
        .from(dailyBar)
        .where(and(eq(dailyBar.contractSymbol, contract.symbol), lt(dailyBar.tradeDate, tradeDate)))
        .orderBy(desc(dailyBar.tradeDate))
        .limit(1)
        .as('last');
      return db
        .select({
          contractSymbol: last.contractSymbol,
          tradeDate: last.tradeDate,
          settle: last.settle,
          collectedAt: last.collectedAt,
          revisedAt: last.revisedAt,
        })
        .from(contract)
        .innerJoinLateral(last, sql`true`)
        .where(inArray(contract.symbol, symbols));
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

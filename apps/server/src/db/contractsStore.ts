import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import type { ContractsStore } from '../api/contracts.ts';
import type { db as Db } from './client.ts';
import { createCommoditiesStore } from './commoditiesStore.ts';
import { createDisparityStore } from './disparityStore.ts';
import { contract, dailyBar } from './schema.ts';

// GET /v1/commodities/:code/contracts 조회(D-092). 조립은 api/contracts.ts·calc가 한다.
export function createContractsStore(db: typeof Db): ContractsStore {
  const { tradingDays, lastSettledTradeDate, frontSymbols, latestSnapshots } =
    createCommoditiesStore(db);
  const { priceDecimals } = createDisparityStore(db);
  return {
    tradingDays,
    lastSettledTradeDate,
    frontSymbols,
    latestSnapshots,
    priceDecimals,
    contracts: (code, tradeDate) =>
      db
        .select({
          symbol: contract.symbol,
          contractMonth: contract.contractMonth,
          lastTradeDate: contract.lastTradeDate,
          isTarget: contract.isTarget,
        })
        .from(contract)
        .where(and(eq(contract.commodityCode, code), gte(contract.lastTradeDate, tradeDate))),
    async settleHistory(symbols, tradeDate) {
      if (symbols.length === 0) return [];
      return db
        .select({
          contractSymbol: dailyBar.contractSymbol,
          tradeDate: dailyBar.tradeDate,
          settle: dailyBar.settle,
          collectedAt: dailyBar.collectedAt,
          revisedAt: dailyBar.revisedAt,
        })
        .from(dailyBar)
        .where(and(inArray(dailyBar.contractSymbol, symbols), lte(dailyBar.tradeDate, tradeDate)))
        .orderBy(asc(dailyBar.tradeDate));
    },
  };
}

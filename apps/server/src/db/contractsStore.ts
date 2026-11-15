import { and, asc, inArray, lte } from 'drizzle-orm';
import type { ContractsStore } from '../api/contracts.ts';
import type { db as Db } from './client.ts';
import { createCommoditiesStore } from './commoditiesStore.ts';
import { createDisparityStore } from './disparityStore.ts';
import { contractsFrom, settleColumns } from './queries.ts';
import { dailyBar } from './schema.ts';

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
    contracts: (code, tradeDate) => contractsFrom(db, code, tradeDate),
    async settleHistory(symbols, tradeDate) {
      if (symbols.length === 0) return [];
      return db
        .select(settleColumns)
        .from(dailyBar)
        .where(and(inArray(dailyBar.contractSymbol, symbols), lte(dailyBar.tradeDate, tradeDate)))
        .orderBy(asc(dailyBar.tradeDate));
    },
  };
}

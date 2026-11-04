// 여러 store가 같이 쓰는 조회
import type { CommodityCode } from '@futureetp/shared';
import { and, asc, between, eq, gte } from 'drizzle-orm';
import type { db as Db } from './client.ts';
import { contract, dailyBar, tradingDay } from './schema.ts';

// from~to 거래일 세션(오름차순)
export const tradingDaysBetween = (db: typeof Db, from: string, to: string) =>
  db
    .select({
      tradeDate: tradingDay.tradeDate,
      sessionOpenAt: tradingDay.sessionOpenAt,
      sessionCloseAt: tradingDay.sessionCloseAt,
      haltStartAt: tradingDay.haltStartAt,
      haltEndAt: tradingDay.haltEndAt,
    })
    .from(tradingDay)
    .where(between(tradingDay.tradeDate, from, to))
    .orderBy(asc(tradingDay.tradeDate));

// 원자재의 월물 중 fromDate 이후에 만기인 것
export const contractsFrom = (db: typeof Db, code: CommodityCode, fromDate: string) =>
  db
    .select({
      symbol: contract.symbol,
      contractMonth: contract.contractMonth,
      lastTradeDate: contract.lastTradeDate,
      isTarget: contract.isTarget,
    })
    .from(contract)
    .where(and(eq(contract.commodityCode, code), gte(contract.lastTradeDate, fromDate)));

// 정산가 행으로 읽는 daily_bar 열
export const settleColumns = {
  contractSymbol: dailyBar.contractSymbol,
  tradeDate: dailyBar.tradeDate,
  settle: dailyBar.settle,
  collectedAt: dailyBar.collectedAt,
  revisedAt: dailyBar.revisedAt,
};

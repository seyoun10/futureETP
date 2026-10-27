import type { Commodities, CommodityCode } from '@futureetp/shared';
import { Hono } from 'hono';
import { marketStatus } from '../calc/marketState.ts';
import type { TradingDaySession } from '../calc/marketState.ts';
import { selectMonthList } from '../calc/monthList.ts';
import type { ListedContract } from '../calc/monthList.ts';
import { buildQuotes } from '../calc/quotes.ts';
import type { QuoteBar, QuoteSnapshot } from '../calc/quotes.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import { ApiException } from './errors.ts';
import { ok } from './response.ts';
import type { SettingsStore } from './settings.ts';

export type CommoditiesStore = {
  // 오름차순
  tradingDays: (from: string, to: string) => Promise<TradingDaySession[]>;
  // 일일 정산 ①이 성공한 가장 최근 거래일(이력이 없으면 저장된 일봉의 마지막 날, jobs/settle.ts와 같다)
  lastSettledTradeDate: () => Promise<string | null>;
  // 표시 순서대로
  commodities: () => Promise<{ code: CommodityCode; priceDecimals: number }[]>;
  // 최종 거래일이 tradeDate 이후인 월물(모든 원자재)
  contracts: (tradeDate: string) => Promise<(ListedContract & { commodityCode: CommodityCode })[]>;
  // 원자재별 tradeDate 이하 가장 최근 대표월물(roll_weight FRONT) 행
  frontSymbols: (
    tradeDate: string,
  ) => Promise<{ commodityCode: CommodityCode; contractSymbol: string }[]>;
  dailyBars: (symbols: string[], dates: string[]) => Promise<QuoteBar[]>;
  // 월물별 그 거래일 최근 스냅숏
  latestSnapshots: (symbols: string[], tradeDate: string) => Promise<QuoteSnapshot[]>;
};

// 직전 거래일(휴장 연휴)과 다음 개장(nextUpdateAt)을 찾을 만큼 읽는다
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 10;

// GET /v1/commodities(A, D-085). 장 상태의 거래일 기준으로 원자재마다 월물 목록과 표시 값을 고른다.
export async function loadCommodities(
  store: CommoditiesStore,
  settings: SettingsStore,
  now: Date,
): Promise<Commodities> {
  const today = now.toISOString().slice(0, 10);
  const [days, lastSettled, commodities, { alertCommodity }] = await Promise.all([
    store.tradingDays(addDays(today, -LOOKBACK_DAYS), addDays(today, LOOKAHEAD_DAYS)),
    store.lastSettledTradeDate(),
    store.commodities(),
    settings.get(),
  ]);
  const status = marketStatus(now, days, lastSettled);
  const tradeDate = status.tradeDate;
  if (tradeDate === null) throw new ApiException('INTERNAL', 'Trading calendar is missing');
  const prevTradeDate = days.findLast((d) => d.tradeDate < tradeDate)?.tradeDate ?? null;

  const [contracts, fronts] = await Promise.all([
    store.contracts(tradeDate),
    store.frontSymbols(tradeDate),
  ]);
  const lists = commodities.map(({ code }) => {
    const frontSymbol = fronts.find((f) => f.commodityCode === code)?.contractSymbol ?? null;
    const own = contracts.filter((c) => c.commodityCode === code);
    return { frontSymbol, contracts: selectMonthList(own, tradeDate, frontSymbol) };
  });
  const symbols = lists.flatMap((l) => l.contracts.map((c) => c.symbol));
  const dates = prevTradeDate === null ? [tradeDate] : [prevTradeDate, tradeDate];
  const [bars, snapshots] = await Promise.all([
    store.dailyBars(symbols, dates),
    store.latestSnapshots(symbols, tradeDate),
  ]);

  let asOf: Date | null = null;
  let delayed = false;
  const summaries = commodities.map(({ code, priceDecimals }, i) => {
    const result = buildQuotes({ ...lists[i], tradeDate, prevTradeDate, bars, snapshots });
    if (result.asOf && (asOf === null || result.asOf > asOf)) asOf = result.asOf;
    delayed ||= result.delayed;
    return { code, priceDecimals, alert: code === alertCommodity, contracts: result.quotes };
  });

  return {
    freshness: {
      // 값이 하나도 없으면(적재 전) 조회 시각
      asOf: (asOf ?? now).toISOString(),
      tradeDate,
      delayed,
      marketState: status.state,
      nextUpdateAt: status.nextUpdateAt?.toISOString() ?? null,
    },
    commodities: summaries,
  };
}

export function commoditiesRoutes(
  store: CommoditiesStore,
  settings: SettingsStore,
  now: () => Date,
) {
  const routes = new Hono();
  routes.get('/', async (c) => ok(c, await loadCommodities(store, settings, now())));
  return routes;
}

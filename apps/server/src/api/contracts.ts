import { COMMODITY_CODES } from '@futureetp/shared';
import type { CommodityCode, ContractsChart } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildContractLines } from '../calc/contractLines.ts';
import { marketStatus } from '../calc/marketState.ts';
import type { ListedContract } from '../calc/monthList.ts';
import { selectMonthList } from '../calc/monthList.ts';
import type { QuoteBar } from '../calc/quotes.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import type { CommoditiesStore } from './commodities.ts';
import type { DisparityStore } from './disparity.ts';
import { ApiException } from './errors.ts';
import { ok } from './response.ts';

export type ContractsStore = Pick<
  CommoditiesStore,
  'tradingDays' | 'lastSettledTradeDate' | 'frontSymbols' | 'latestSnapshots'
> &
  Pick<DisparityStore, 'priceDecimals'> & {
    // 최종 거래일이 tradeDate 이후인 그 원자재의 월물
    contracts: (code: CommodityCode, tradeDate: string) => Promise<ListedContract[]>;
    // 월물별 tradeDate 이하 일봉 전체
    settleHistory: (symbols: string[], tradeDate: string) => Promise<QuoteBar[]>;
  };

// 직전 거래일(휴장 연휴)과 다음 개장(nextUpdateAt)을 찾을 만큼 읽는다(commodities.ts와 같다)
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 10;

// GET /v1/commodities/:code/contracts(C-c, D-092). A와 같은 월물 목록의 원가격 선 전체를 한 번에 준다.
export async function loadContracts(
  store: ContractsStore,
  code: CommodityCode,
  now: Date,
): Promise<ContractsChart> {
  const today = now.toISOString().slice(0, 10);
  const [days, lastSettled, priceDecimals] = await Promise.all([
    store.tradingDays(addDays(today, -LOOKBACK_DAYS), addDays(today, LOOKAHEAD_DAYS)),
    store.lastSettledTradeDate(),
    store.priceDecimals(code),
  ]);
  if (priceDecimals === null) throw new ApiException('INTERNAL', `Commodity ${code} is missing`);
  const status = marketStatus(now, days, lastSettled);
  const tradeDate = status.tradeDate;
  if (tradeDate === null) throw new ApiException('INTERNAL', 'Trading calendar is missing');

  const [listed, fronts] = await Promise.all([
    store.contracts(code, tradeDate),
    store.frontSymbols(tradeDate),
  ]);
  const frontSymbol = fronts.find((f) => f.commodityCode === code)?.contractSymbol ?? null;
  const contracts = selectMonthList(listed, tradeDate, frontSymbol);
  const symbols = contracts.map((c) => c.symbol);
  const [bars, snapshots] = await Promise.all([
    store.settleHistory(symbols, tradeDate),
    store.latestSnapshots(symbols, tradeDate),
  ]);
  const result = buildContractLines({ contracts, tradeDate, bars, snapshots });
  if (result.dates.length === 0) throw new ApiException('NOT_FOUND', `No daily bars for ${code}`);

  return {
    freshness: {
      asOf: (result.asOf ?? now).toISOString(),
      tradeDate,
      delayed: result.provisional,
      marketState: status.state,
      nextUpdateAt: status.nextUpdateAt?.toISOString() ?? null,
    },
    priceDecimals,
    dates: result.dates,
    provisional: result.provisional,
    contracts: result.lines,
  };
}

export function contractsRoutes(store: ContractsStore, now: () => Date) {
  const routes = new Hono();
  routes.get('/:code/contracts', async (c) => {
    const code = z.enum(COMMODITY_CODES).safeParse(c.req.param('code'));
    if (!code.success)
      throw new ApiException('NOT_FOUND', `Unknown commodity ${c.req.param('code')}`);
    return ok(c, await loadContracts(store, code.data, now()));
  });
  return routes;
}

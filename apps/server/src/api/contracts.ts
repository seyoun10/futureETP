import type { CommodityCode, ContractsChart } from '@futureetp/shared';
import { Hono } from 'hono';
import { buildContractLines } from '../calc/contractLines.ts';
import type { ListedContract } from '../calc/monthList.ts';
import { selectMonthList } from '../calc/monthList.ts';
import type { QuoteBar } from '../calc/quotes.ts';
import type { CommoditiesStore } from './commodities.ts';
import { beforeSchema, pageRange } from './chartPage.ts';
import { ApiException } from './errors.ts';
import { freshness, loadChartMarket } from './market.ts';
import type { ChartMarketStore } from './market.ts';
import { commodityCodeParam, parseInput } from './params.ts';
import { ok } from './response.ts';

export type ContractsStore = ChartMarketStore &
  Pick<CommoditiesStore, 'frontSymbols' | 'latestSnapshots'> & {
    // 최종 거래일이 tradeDate 이후인 그 원자재의 월물
    contracts: (code: CommodityCode, tradeDate: string) => Promise<ListedContract[]>;
    // 월물별 tradeDate 이하 일봉 전체
    settleHistory: (symbols: string[], tradeDate: string) => Promise<QuoteBar[]>;
  };

// GET /v1/commodities/:code/contracts(C-c, D-092). A와 같은 월물 목록의 원가격 선을 최근 3년씩 준다(D-104).
// before를 주면 그 날짜보다 이른 3년이다
export async function loadContracts(
  store: ContractsStore,
  code: CommodityCode,
  now: Date,
  before?: string,
): Promise<ContractsChart> {
  const { status, tradeDate, priceDecimals } = await loadChartMarket(
    store,
    code,
    now,
    Promise.resolve(null),
  );

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
  const page = pageRange(result.dates, before);

  return {
    freshness: freshness(status, tradeDate, result.asOf, result.provisional, now),
    priceDecimals,
    dates: result.dates.slice(page.start, page.end),
    hasMore: page.hasMore,
    provisional: result.provisional,
    contracts: result.lines.map((l, i) => ({
      ...l,
      lastTradeDate: contracts[i].lastTradeDate,
      isFront: l.symbol === frontSymbol,
      prices: l.prices.slice(page.start, page.end),
    })),
  };
}

export function contractsRoutes(store: ContractsStore, now: () => Date) {
  const routes = new Hono();
  routes.get('/:code/contracts', async (c) => {
    const code = commodityCodeParam(c.req.param('code'));
    const before = parseInput(beforeSchema, c.req.query('before'));
    return ok(c, await loadContracts(store, code, now(), before));
  });
  return routes;
}

import type { CommodityCode, Curve } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { buildCurve, CURVE_VOLUME_DAYS, resolveBaseDate } from '../calc/curve.ts';
import type { CurveBar, CurveListing } from '../calc/curve.ts';
import { marketStatus } from '../calc/marketState.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import type { CommoditiesStore } from './commodities.ts';
import type { DisparityStore } from './disparity.ts';
import { ApiException } from './errors.ts';
import { commodityCodeParam } from './params.ts';
import { ok } from './response.ts';

export type CurveStore = Pick<
  CommoditiesStore,
  'tradingDays' | 'lastSettledTradeDate' | 'latestSnapshots'
> &
  Pick<DisparityStore, 'priceDecimals'> & {
    // 그 원자재의 가장 이른 일봉 날짜(기준일 하한, D-020). 적재 전이면 null
    firstBarDate: (code: CommodityCode) => Promise<string | null>;
    // 거래일 날짜만(과거 행 포함), 오름차순
    tradeDates: (from: string, to: string) => Promise<string[]>;
    // 최종 거래일이 fromDate 이후인 그 원자재의 월물과 월물별 가장 이른 일봉 날짜
    contracts: (code: CommodityCode, fromDate: string) => Promise<CurveListing[]>;
    // 그 날짜 전(미만) 가장 최근 FRONT roll_weight 행의 월물 = 그날 보유한 대표월물(D-068)
    frontSymbol: (code: CommodityCode, before: string) => Promise<string | null>;
    dailyBars: (symbols: string[], dates: string[]) => Promise<CurveBar[]>;
  };

const querySchema = z.object({ baseDate: z.iso.date().optional() });

// 직전 거래일(휴장 연휴)과 다음 개장(nextUpdateAt)을 찾을 만큼 읽는다(commodities.ts와 같다)
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 10;
// 거래량 창 20거래일과 휴장일로 옮길 직전 거래일을 덮는 달력 일수
const VOLUME_LOOKBACK_DAYS = 45;

// GET /v1/commodities/:code/curve(C-b, D-046). 커브는 저장하지 않고 원천값으로 calc를 부른다.
// 기준일 커브와 그 다음 거래일(비교일) 커브를 비교한다(D-114).
export async function loadCurve(
  store: CurveStore,
  code: CommodityCode,
  requestedBaseDate: string | null,
  now: Date,
): Promise<Curve> {
  const today = now.toISOString().slice(0, 10);
  const [days, lastSettled, priceDecimals, firstBarDate] = await Promise.all([
    store.tradingDays(addDays(today, -LOOKBACK_DAYS), addDays(today, LOOKAHEAD_DAYS)),
    store.lastSettledTradeDate(),
    store.priceDecimals(code),
    store.firstBarDate(code),
  ]);
  if (priceDecimals === null) throw new ApiException('INTERNAL', `Commodity ${code} is missing`);
  const status = marketStatus(now, days, lastSettled);
  const currentDate = status.tradeDate;
  if (currentDate === null) throw new ApiException('INTERNAL', 'Trading calendar is missing');
  if (firstBarDate === null) throw new ApiException('NOT_FOUND', `No daily bars for ${code}`);

  const from =
    requestedBaseDate !== null && requestedBaseDate < currentDate ? requestedBaseDate : currentDate;
  const tradeDates = await store.tradeDates(addDays(from, -VOLUME_LOOKBACK_DAYS), currentDate);
  const range = resolveBaseDate(tradeDates, currentDate, firstBarDate, requestedBaseDate);
  if (range === null) throw new ApiException('NOT_FOUND', `Not enough daily bars for ${code}`);
  const { baseDate } = range;
  // 비교 커브 날짜 = 기준일 다음 거래일. 기준일이 D-1이면 D다
  const compareDate = range.nextBaseDate ?? currentDate;

  const [contracts, baseFront, compareFront] = await Promise.all([
    store.contracts(code, baseDate),
    store.frontSymbol(code, baseDate),
    store.frontSymbol(code, compareDate),
  ]);
  const symbols = contracts.map((c) => c.symbol);
  // 기준일·비교일과 각자의 거래량 창(그날 정산 여부와 관계없이 덮도록 그 전 20거래일까지)
  const windowDates = (date: string) => {
    const end = tradeDates.indexOf(date);
    return tradeDates.slice(Math.max(end - CURVE_VOLUME_DAYS, 0), end + 1);
  };
  const dates = [...new Set([...windowDates(baseDate), ...windowDates(compareDate)])];
  const compareSettled = lastSettled !== null && lastSettled >= compareDate;
  const [bars, snapshots] = await Promise.all([
    store.dailyBars(symbols, dates),
    compareSettled ? Promise.resolve([]) : store.latestSnapshots(symbols, compareDate),
  ]);

  const curve = buildCurve({
    contracts,
    tradeDates,
    baseDate,
    currentDate: compareDate,
    currentSettled: compareSettled,
    baseFront,
    currentFront: compareFront,
    bars,
    snapshots,
  });

  return {
    freshness: {
      // 값이 하나도 없거나 비교일이 지난 거래일(확정 정산가)이면 조회 시각
      asOf: ((compareDate === currentDate ? curve.asOf : null) ?? now).toISOString(),
      tradeDate: currentDate,
      delayed: curve.delayed,
      marketState: status.state,
      nextUpdateAt: status.nextUpdateAt?.toISOString() ?? null,
    },
    priceDecimals,
    ...range,
    compareDate,
    points: curve.points.map(({ symbol, contractMonth, basePrice, currentPrice, changePct }) => ({
      symbol,
      contractMonth,
      basePrice,
      currentPrice,
      changePct,
    })),
    current: stats(curve.current),
    base: stats(curve.base),
  };
}

const stats = (s: ReturnType<typeof buildCurve>['base']) =>
  s === null
    ? null
    : {
        m1ContractMonth: s.m1ContractMonth,
        m2ContractMonth: s.m2ContractMonth,
        state: s.state,
        spreadPct: s.spreadPct,
        rollYieldPct: s.rollYieldPct,
      };

export function curveRoutes(store: CurveStore, now: () => Date) {
  const routes = new Hono();
  routes.get('/:code/curve', async (c) => {
    const code = commodityCodeParam(c.req.param('code'));
    const query = querySchema.safeParse(c.req.query());
    if (!query.success) throw new ApiException('VALIDATION_FAILED', z.prettifyError(query.error));
    return ok(c, await loadCurve(store, code, query.data.baseDate ?? null, now()));
  });
  return routes;
}

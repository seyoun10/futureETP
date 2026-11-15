import type { CommodityCode, Freshness } from '@futureetp/shared';
import { marketStatus } from '../calc/marketState.ts';
import type { MarketStatus, TradingDaySession } from '../calc/marketState.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import type { CommoditiesStore } from './commodities.ts';
import { ApiException } from './errors.ts';

export type MarketStore = Pick<CommoditiesStore, 'tradingDays' | 'lastSettledTradeDate'>;

export type Market<T> = {
  // 오름차순, 오늘 전후 LOOKBACK/LOOKAHEAD 범위
  days: TradingDaySession[];
  lastSettled: string | null;
  status: MarketStatus;
  // 장 상태의 거래일
  tradeDate: string;
  // 같이 읽은 라우트별 값
  extra: T;
};

// 직전 거래일(휴장 연휴)과 다음 개장(nextUpdateAt)을 찾을 만큼 읽는다
const LOOKBACK_DAYS = 30;
const LOOKAHEAD_DAYS = 10;

// 조회 API 공통 프롤로그: 거래일 달력·마지막 정산 거래일과 라우트별 값(extra)을 함께 읽어 장 상태를 낸다.
export function loadMarket<T>(
  store: MarketStore,
  now: Date,
  extra: Promise<T>,
): Promise<Market<T>> {
  return loadMarketWith(store, now, extra, (loaded) => loaded);
}

// prepare는 달력 검사보다 먼저 extra를 검사·변환한다
async function loadMarketWith<T, U>(
  store: MarketStore,
  now: Date,
  extra: Promise<T>,
  prepare: (extra: T) => U,
): Promise<Market<U>> {
  const today = now.toISOString().slice(0, 10);
  const [days, lastSettled, loaded] = await Promise.all([
    store.tradingDays(addDays(today, -LOOKBACK_DAYS), addDays(today, LOOKAHEAD_DAYS)),
    store.lastSettledTradeDate(),
    extra,
  ]);
  const prepared = prepare(loaded);
  const status = marketStatus(now, days, lastSettled);
  const tradeDate = status.tradeDate;
  if (tradeDate === null) throw new ApiException('INTERNAL', 'Trading calendar is missing');
  return { days, lastSettled, status, tradeDate, extra: prepared };
}

export type ChartMarketStore = MarketStore & {
  priceDecimals: (code: CommodityCode) => Promise<number | null>;
};

// 원자재 하나의 차트 조회(C-a·C-b·C-c): loadMarket에 그 원자재의 가격 소수 자릿수를 더한다
export async function loadChartMarket<T>(
  store: ChartMarketStore,
  code: CommodityCode,
  now: Date,
  extra: Promise<T>,
): Promise<Market<T> & { priceDecimals: number }> {
  const market = await loadMarketWith(
    store,
    now,
    Promise.all([store.priceDecimals(code), extra]),
    ([priceDecimals, loaded]) => {
      if (priceDecimals === null)
        throw new ApiException('INTERNAL', `Commodity ${code} is missing`);
      return { priceDecimals, loaded };
    },
  );
  return { ...market, priceDecimals: market.extra.priceDecimals, extra: market.extra.loaded };
}

// 응답의 freshness. asOf가 없으면(값이 하나도 없음) 조회 시각
export function freshness(
  status: MarketStatus,
  tradeDate: string,
  asOf: Date | null | undefined,
  delayed: boolean,
  now: Date,
): Freshness {
  return {
    asOf: (asOf ?? now).toISOString(),
    tradeDate,
    delayed,
    marketState: status.state,
    nextUpdateAt: status.nextUpdateAt?.toISOString() ?? null,
  };
}

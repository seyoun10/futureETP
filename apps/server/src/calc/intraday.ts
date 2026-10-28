// 장중 배치(INTRADAY)의 대상 월물과 오늘 잠정 지수·이격도(D-067, D-086, D-094).
// 잠정 지수는 직전 거래일 종가 뒤 보유 비중(그날 보유 월물)으로 지금 가격을 직전 유효일에 이어 붙인 원래 지수다.
import { MA_PERIODS, type MaPeriod } from '@futureetp/shared';
import { CURVE_MAX_CONTRACTS } from './curve.ts';
import { liveDisparity } from './disparity.ts';
import { chainIndex, type HeldWeights } from './indexChain.ts';
import { byExpiry, type ListedContract } from './monthList.ts';

// 이평선 4종 현재가·고가·저가 이격도(index_snapshot.disparity_by_ma)
export type DisparityByMa = Record<
  `${MaPeriod}`,
  { last: number | null; high: number | null; low: number | null }
>;

// 월물 하나의 장중 값. 세션 값이 없으면(현재가만 받은 월물·세션 첫 체결 전) null
export type SessionPrice = {
  last: number;
  dayOpen: number | null;
  dayHigh: number | null;
  dayLow: number | null;
};

// index_bar 한 행(맞춤 전 원래 지수)
export type IndexHistoryRow = {
  tradeDate: string;
  close: number | null;
  blendedPrice: number;
  isValid: boolean;
};

export type IndexAnchor = {
  // 직전 유효일 종가 지수와 그날 혼합 가격
  close: number;
  blendedPrice: number;
  // 유효 종가(오래된 순). 잠정 이평선에 쓴다
  prevCloses: number[];
};

export type IntradayIndex = {
  open: number | null;
  high: number | null;
  low: number | null;
  last: number | null;
  disparityByMa: DisparityByMa;
};

// 장중에 받을 커브 월물: 거래일 T에 만기 전인 대상 월물을 만기순으로 커브 상한(24개)까지.
// 거래량 기준(D-018)은 커브 조회가 적용하므로 여기서는 거르지 않는다
export function intradayCurveContracts<T extends ListedContract>(
  contracts: readonly T[],
  tradeDate: string,
): T[] {
  return contracts
    .filter((c) => c.isTarget && c.lastTradeDate >= tradeDate)
    .sort(byExpiry)
    .slice(0, CURVE_MAX_CONTRACTS);
}

// 저장된 index_bar(오름차순)에서 이어 붙일 직전 유효일. 유효일이 없으면 null
export function indexAnchor(rows: readonly IndexHistoryRow[]): IndexAnchor | null {
  const valid = rows.filter(
    (r): r is IndexHistoryRow & { close: number } => r.isValid && r.close !== null,
  );
  const last = valid[valid.length - 1];
  if (last === undefined) return null;
  return {
    close: last.close,
    blendedPrice: last.blendedPrice,
    prevCloses: valid.map((r) => r.close),
  };
}

const positiveOrNull = (v: number) => (v > 0 ? v : null);

// 잠정 지수 봉과 이평선 4종 이격도. 보유 월물의 장중 값이 하나라도 없으면 던진다.
// 세션 값이 없는 월물은 현재가로 대신한다(index_bar가 거래 없는 월물에 정산가를 쓰는 것과 같다)
export function intradayIndex(
  anchor: IndexAnchor,
  weights: HeldWeights,
  prices: ReadonlyMap<string, SessionPrice>,
): IntradayIndex {
  const priceOf = (symbol: string) => {
    const price = prices.get(symbol);
    if (price === undefined) throw new Error(`${symbol} 장중 가격이 없다`);
    return price;
  };
  const index = (field: (p: SessionPrice) => number) =>
    positiveOrNull(
      chainIndex(anchor.close, anchor.blendedPrice, weights, (s) => field(priceOf(s))),
    );

  const last = index((p) => p.last);
  const high = index((p) => p.dayHigh ?? p.last);
  const low = index((p) => p.dayLow ?? p.last);
  const disparity = (price: number | null, ma: MaPeriod) =>
    price === null ? null : liveDisparity(anchor.prevCloses, price, ma);
  const disparityByMa = Object.fromEntries(
    MA_PERIODS.map((ma) => [
      ma,
      { last: disparity(last, ma), high: disparity(high, ma), low: disparity(low, ma) },
    ]),
  ) as DisparityByMa;
  return { open: index((p) => p.dayOpen ?? p.last), high, low, last, disparityByMa };
}

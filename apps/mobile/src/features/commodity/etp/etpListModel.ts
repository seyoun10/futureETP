import { ETP_MARKETS } from '@futureetp/shared';
import type { EtpMarket, EtpSummary, EtpType, FxHedge } from '@futureetp/shared';

// C-d 필터. 'ALL'은 거르지 않는다. 선택은 기억하지 않는다(D-017)
export type EtpFilters = {
  market: EtpMarket | 'ALL';
  type: EtpType | 'ALL';
  leverage: number | 'ALL';
  fxHedge: FxHedge | 'ALL';
};
export const NO_FILTERS: EtpFilters = {
  market: 'ALL',
  type: 'ALL',
  leverage: 'ALL',
  fxHedge: 'ALL',
};

export const ETP_SORTS = ['DEFAULT', 'AUM', 'TRADING_VALUE'] as const;
export type EtpSort = (typeof ETP_SORTS)[number];

export const filterEtps = (etps: readonly EtpSummary[], filters: EtpFilters): EtpSummary[] =>
  etps.filter(
    (etp) =>
      (filters.market === 'ALL' || etp.market === filters.market) &&
      (filters.type === 'ALL' || etp.type === filters.type) &&
      (filters.leverage === 'ALL' || etp.leverage === filters.leverage) &&
      (filters.fxHedge === 'ALL' || etp.fxHedge === filters.fxHedge),
  );

// 배수 순서: 양수 먼저, 각각 절댓값 오름차순(1, 2, -1, -2)
export const compareLeverage = (a: number, b: number): number =>
  Number(a < 0) - Number(b < 0) || Math.abs(a) - Math.abs(b);

const byMarket = (a: EtpSummary, b: EtpSummary) =>
  ETP_MARKETS.indexOf(a.market) - ETP_MARKETS.indexOf(b.market);

// 기본: 시장(KRX → US), 배수, 이름순(screens.md C-d)
const byDefault = (a: EtpSummary, b: EtpSummary) =>
  byMarket(a, b) || compareLeverage(a.leverage, b.leverage) || a.name.localeCompare(b.name);

// 큰 순서이고 값이 없으면 뒤로
const byValueDesc = (a: number | null, b: number | null) =>
  a === b ? 0 : a === null ? 1 : b === null ? -1 : b - a;

const VALUE: Record<Exclude<EtpSort, 'DEFAULT'>, (etp: EtpSummary) => number | null> = {
  AUM: (etp) => etp.aum,
  TRADING_VALUE: (etp) => etp.avgTradingValue,
};

// 순자산·거래대금은 통화가 달라 시장 안에서만 정렬한다(D-017)
export function sortEtps(etps: readonly EtpSummary[], sort: EtpSort): EtpSummary[] {
  if (sort === 'DEFAULT') return [...etps].sort(byDefault);
  const value = VALUE[sort];
  return [...etps].sort(
    (a, b) => byMarket(a, b) || byValueDesc(value(a), value(b)) || byDefault(a, b),
  );
}

// 배수 필터 선택지: 받은 상품에 있는 배수만
export const leverageOptions = (etps: readonly EtpSummary[]): number[] =>
  [...new Set(etps.map((etp) => etp.leverage))].sort(compareLeverage);

// 정렬 값(행 둘째 줄 끝에 붙임)
export const sortValue = (etp: EtpSummary, sort: EtpSort): number | null | undefined =>
  sort === 'DEFAULT' ? undefined : VALUE[sort](etp);

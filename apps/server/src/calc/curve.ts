// 월물커브(C-b): 커브 월물 선택, 기준일 대비 변화율, M1→M2 스프레드·연환산 롤 수익률
// (product.md 계산 정의 > 커브, D-018, D-026, D-068).

import type { CurveState } from '@futureetp/shared';
import type { ListedContract } from './monthList.ts';

// 커브에 넣는 월물의 직전 거래일 평균 거래량 하한(계약)
export const CURVE_MIN_AVG_VOLUME = 100;
// 평균 거래량 창(거래일)
export const CURVE_VOLUME_DAYS = 20;
// 커브 월물 최대 개수
export const CURVE_MAX_CONTRACTS = 24;

const DAY_MS = 24 * 60 * 60 * 1000;

type Expiry = Pick<ListedContract, 'lastTradeDate' | 'contractMonth'>;

const byExpiry = (a: Expiry, b: Expiry) =>
  a.lastTradeDate.localeCompare(b.lastTradeDate) || a.contractMonth.localeCompare(b.contractMonth);

// 평균 거래량 창: 거래일(오름차순) 중 커브 날짜까지의 마지막 20거래일.
// 커브 날짜의 정산이 아직 없으면(D가 장중·정산 대기) 그날을 빼고 전일까지로 센다.
export function volumeWindow(
  tradingDays: readonly string[],
  curveDate: string,
  settled: boolean,
): string[] {
  const upTo = tradingDays.filter((d) => (settled ? d <= curveDate : d < curveDate));
  return upTo.slice(-CURVE_VOLUME_DAYS);
}

// 창 안에 일봉이 있는 날만으로 평균한다(상장 후 20거래일이 안 된 월물). 하나도 없으면 0
export function averageVolume(
  bars: readonly { tradeDate: string; volume: number }[],
  window: readonly string[],
): number {
  const days = new Set(window);
  const volumes = bars.filter((b) => days.has(b.tradeDate)).map((b) => b.volume);
  return volumes.length === 0 ? 0 : volumes.reduce((s, v) => s + v, 0) / volumes.length;
}

// 커브 후보: 월물 + 그 커브 날짜의 값(정산가, 없으면 최근 스냅숏, D-048)과 평균 거래량
export type CurveCandidate = ListedContract & {
  // null = 그날 값이 없음(아직 상장 전 등)
  price: number | null;
  avgVolume: number;
};

export type CurvePoint<T extends CurveCandidate = CurveCandidate> = T & { price: number };

export type Curve<T extends CurveCandidate = CurveCandidate> = {
  // 만기순
  contracts: CurvePoint<T>[];
  // M1 = 그날 보유한 대표월물, M2 = 커브에서 M1 다음 월물. 없으면 null
  m1: CurvePoint<T> | null;
  m2: CurvePoint<T> | null;
};

// 커브 날짜 curveDate의 월물을 고른다.
// - 그날 만기되지 않았고 값이 있는 대상 월물을 만기순으로 잇는다.
// - M1보다 만기가 이른 월물과 M1·M2는 거래량과 관계없이 넣는다. 미달 판정은 M2부터 하고,
//   처음 미달한 월물에서 멈춘다(M2가 미달이면 M2까지). 최대 24개.
// - frontSymbol이 후보에 없으면 처음부터 거래량으로 판정하고 m1·m2는 null이다.
export function selectCurve<T extends CurveCandidate>(
  candidates: readonly T[],
  curveDate: string,
  frontSymbol: string | null,
): Curve<T> {
  const sorted = candidates
    .filter(
      (c): c is CurvePoint<T> => c.isTarget && c.lastTradeDate >= curveDate && c.price !== null,
    )
    .sort(byExpiry);
  const m1Index = sorted.findIndex((c) => c.symbol === frontSymbol);

  const contracts: CurvePoint<T>[] = [];
  for (const [i, c] of sorted.entries()) {
    if (contracts.length === CURVE_MAX_CONTRACTS) break;
    if (i <= m1Index) {
      contracts.push(c);
      continue;
    }
    const isM2 = m1Index >= 0 && i === m1Index + 1;
    const passes = c.avgVolume >= CURVE_MIN_AVG_VOLUME;
    if (passes || isM2) contracts.push(c);
    if (!passes) break;
  }

  const m1 = m1Index >= 0 ? (contracts[m1Index] ?? null) : null;
  const m2 = m1Index >= 0 ? (contracts[m1Index + 1] ?? null) : null;
  return { contracts, m1, m2 };
}

export type CurveComparisonPoint = {
  symbol: string;
  contractMonth: string;
  lastTradeDate: string;
  // 그 커브에 없으면 null
  basePrice: number | null;
  currentPrice: number | null;
  // 두 커브에 모두 있고 기준일 값이 0보다 클 때만 (현재 / 기준일 − 1) × 100
  changePct: number | null;
};

// 기준일 커브와 현재(D) 커브를 월물로 합친다(만기순). 기준일에만 있는 월물(그 사이 만기)과
// 현재에만 있는 월물(신규 상장·거래량 기준 변화)은 한쪽 값만 있고 변화율이 없다.
export function compareCurves(
  base: readonly CurvePoint[],
  current: readonly CurvePoint[],
): CurveComparisonPoint[] {
  const merged = new Map<string, CurveComparisonPoint>();
  const entry = (c: CurvePoint) =>
    merged.get(c.symbol) ?? {
      symbol: c.symbol,
      contractMonth: c.contractMonth,
      lastTradeDate: c.lastTradeDate,
      basePrice: null,
      currentPrice: null,
      changePct: null,
    };
  for (const c of base) merged.set(c.symbol, { ...entry(c), basePrice: c.price });
  for (const c of current) merged.set(c.symbol, { ...entry(c), currentPrice: c.price });

  return [...merged.values()]
    .map((p) => ({
      ...p,
      changePct:
        p.basePrice !== null && p.currentPrice !== null && p.basePrice > 0
          ? (p.currentPrice / p.basePrice - 1) * 100
          : null,
    }))
    .sort(byExpiry);
}

export type CurveSummary = {
  // M2 > M1 콘탱고, M2 < M1 백워데이션
  state: CurveState;
  // (M2 / M1 − 1) × 100
  spreadPct: number;
  // (M1 / M2 − 1) × 365 / daysBetween × 100. 양수 = 백워데이션(롤 이익)
  rollYieldPct: number;
  // M1과 M2 최종 거래일 사이의 달력 일수
  daysBetween: number;
};

// M1→M2 커브 상태·스프레드·연환산 롤 수익률. M1·M2가 없거나 값이 0 이하이거나
// 두 최종 거래일이 같거나 거꾸로면 null
export function curveSummary(m1: CurvePoint | null, m2: CurvePoint | null): CurveSummary | null {
  if (m1 === null || m2 === null || m1.price <= 0 || m2.price <= 0) return null;
  const daysBetween = (Date.parse(m2.lastTradeDate) - Date.parse(m1.lastTradeDate)) / DAY_MS;
  if (daysBetween <= 0) return null;
  const state: CurveState =
    m2.price > m1.price ? 'CONTANGO' : m2.price < m1.price ? 'BACKWARDATION' : 'FLAT';
  return {
    state,
    spreadPct: (m2.price / m1.price - 1) * 100,
    rollYieldPct: (((m1.price / m2.price - 1) * 365) / daysBetween) * 100,
    daysBetween,
  };
}

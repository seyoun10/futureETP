// 이평선·이격도 시계열(disparity)과 최근 N년 이격도 분포(disparity_distribution),
// rare 레벨·꼬리 백분위를 만든다(product.md 계산 정의 > 이격도와 rare 레벨, D-002, D-067).
import type { Direction, Window } from '@futureetp/shared';

export type CloseBar = {
  tradeDate: string;
  // 맞춤 전 원래 지수 종가. 산출 불가일은 null
  close: number | null;
};

export type DisparityRow = {
  tradeDate: string;
  // 이평선(원래 지수 단위). 초기 K−1개는 null
  ma: number | null;
  disparity: number | null;
};

export type Distribution = {
  asOfTradeDate: string;
  actualStartDate: string;
  sampleCount: number;
  // 오름차순 이격도
  sortedValues: number[];
};

const disparityOf = (price: number, ma: number) => (price / ma - 1) * 100;

const mean = (values: readonly number[]) => values.reduce((sum, v) => sum + v, 0) / values.length;

// 거래일(오름차순)마다 이격도 행을 만든다. 산출 불가일은 행을 내지 않고,
// 이평선 창은 유효 종가만 이어서 K개를 쓴다(산출 불가일을 건너뜀)
export function buildDisparitySeries(bars: readonly CloseBar[], maPeriod: number): DisparityRow[] {
  const closes: number[] = [];
  const rows: DisparityRow[] = [];
  for (const { tradeDate, close } of bars) {
    if (close === null) continue;
    closes.push(close);
    if (closes.length < maPeriod) {
      rows.push({ tradeDate, ma: null, disparity: null });
      continue;
    }
    const ma = mean(closes.slice(-maPeriod));
    rows.push({ tradeDate, ma, disparity: disparityOf(close, ma) });
  }
  return rows;
}

const WINDOW_YEARS: Record<Exclude<Window, 'ALL'>, number> = { Y3: 3, Y5: 5, Y10: 10 };

const isLeapYear = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

// 분포 기간의 시작 경계(이 날짜 초과만 씀). 기준 거래일에서 N년 빼고, 2월 29일은 2월 28일로 둔다. ALL은 null
export function windowStartExclusive(asOfTradeDate: string, window: Window): string | null {
  if (window === 'ALL') return null;
  const [y, m, d] = asOfTradeDate.split('-');
  const year = Number(y) - WINDOW_YEARS[window];
  const day = m === '02' && d === '29' && !isLeapYear(year) ? '28' : d;
  return `${String(year).padStart(4, '0')}-${m}-${day}`;
}

// 기준 거래일까지 최근 N년(경계 초과)의 이격도를 오름차순으로 모은다. 표본이 없으면 null
export function buildDistribution(
  series: readonly DisparityRow[],
  asOfTradeDate: string,
  window: Window,
): Distribution | null {
  const start = windowStartExclusive(asOfTradeDate, window);
  const samples = series.filter(
    (row): row is DisparityRow & { disparity: number } =>
      row.disparity !== null &&
      row.tradeDate <= asOfTradeDate &&
      (start === null || row.tradeDate > start),
  );
  if (samples.length === 0) return null;
  return {
    asOfTradeDate,
    // 시계열이 거래일 오름차순이라 첫 표본이 실제 시작일이다
    actualStartDate: samples[0].tradeDate,
    sampleCount: samples.length,
    sortedValues: samples.map((r) => r.disparity).sort((a, b) => a - b),
  };
}

// q번째 백분위(0~100). numpy 기본 linear(= Excel PERCENTILE.INC) 보간
export function percentile(sorted: readonly number[], q: number): number {
  const h = (q / 100) * (sorted.length - 1);
  const lo = Math.floor(h);
  if (lo >= sorted.length - 1) return sorted[sorted.length - 1];
  return sorted[lo] + (h - lo) * (sorted[lo + 1] - sorted[lo]);
}

// rare 레벨 p%의 이격도. 위 방향은 넘은 날이 p%인 지점, 아래 방향은 낮은 날이 p%인 지점
export function rareLevelDisparity(
  sorted: readonly number[],
  direction: Direction,
  p: number,
): number {
  return percentile(sorted, direction === 'UP' ? 100 - p : p);
}

// rare-level 선의 가격: 이평선을 따라 움직이는 밴드
export function rareLevelPrice(ma: number, levelDisparity: number): number {
  return ma * (1 + levelDisparity / 100);
}

// percentile의 역함수(0~100). 같은 값이 여러 개면 그 순위 구간의 가운데, 범위 밖은 0·100으로 자른다
export function percentileRank(sorted: readonly number[], x: number): number {
  const n = sorted.length;
  if (n === 1) return 50;
  const below = sorted.filter((v) => v < x).length;
  const atOrBelow = sorted.filter((v) => v <= x).length;
  let h: number;
  if (atOrBelow > below) h = (below + atOrBelow - 1) / 2;
  else if (below === 0) return 0;
  else if (below === n) return 100;
  else h = below - 1 + (x - sorted[below - 1]) / (sorted[below] - sorted[below - 1]);
  return (h / (n - 1)) * 100;
}

// 가까운 꼬리 기준 표시값: 중앙값보다 위면 상위 p%, 아니면 하위 p%
export function tailPercentile(
  sorted: readonly number[],
  x: number,
): { side: Direction; pct: number } {
  const r = percentileRank(sorted, x);
  return r > 50 ? { side: 'UP', pct: 100 - r } : { side: 'DOWN', pct: r };
}

// 오늘 잠정 이격도: 직전 유효 종가 K−1개(오래된 순 배열의 끝)와 오늘 가격으로 이평선과 분자를 함께 계산한다.
// 알림 판정은 가격 자리에 고가·저가를 넣는다
export function liveDisparity(
  prevCloses: readonly number[],
  price: number,
  maPeriod: number,
): number | null {
  const ma = liveMovingAverage(prevCloses, price, maPeriod);
  return ma === null ? null : disparityOf(price, ma);
}

// 오늘 잠정 이평선(liveDisparity의 이평선). 가격·이평선이 0 이하이면 null
export function liveMovingAverage(
  prevCloses: readonly number[],
  price: number,
  maPeriod: number,
): number | null {
  if (prevCloses.length < maPeriod - 1 || price <= 0) return null;
  const ma = mean([...prevCloses.slice(prevCloses.length - (maPeriod - 1)), price]);
  return ma > 0 ? ma : null;
}

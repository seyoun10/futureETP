// useChartViewport의 판단만 모은 순수 함수. 제스처·행렬 쓰기는 훅에 남긴다.
import type { CandleGeom, Transform } from './fitTransform';

const EPSILON = 1e-3;

// 드래그(이동)는 보이는 봉 수가 그대로라 기간 선택 표시를 남기고, 핀치(확대·축소)는 지운다(screens.md C-a)
export type ChartGesture = 'pan' | 'zoom';

// 봉 좌표가 어느 날짜 구간인지(과거 봉이 앞에 붙었는지 판단용)
export type DateSpan = { first: string; last: string };

const near = (a: number, b: number) => {
  'worklet';
  return Math.abs(a - b) < EPSILON;
};

// 봉 x 좌표(폭·첫 봉 위치·간격·봉 수)가 같은지
export const sameX = (a: CandleGeom, b: CandleGeom) => {
  'worklet';
  return (
    a.left === b.left &&
    a.right === b.right &&
    a.x0 === b.x0 &&
    a.dx === b.dx &&
    a.highY.length === b.highY.length
  );
};

export const sameTransform = (a: Transform, b: Transform) => {
  'worklet';
  return near(a.k, b.k) && near(a.tx, b.tx) && near(a.ky, b.ky) && near(a.ty, b.ty);
};

// 앞에 붙은 봉 수. 첫 날짜가 앞당겨지고 마지막 날짜가 같을 때만이다(새로고침으로 오늘 봉이 붙는 경우와 구분)
export function prependedBars(
  prev: { barCount: number; span: DateSpan } | null,
  barCount: number,
  span: DateSpan,
): number {
  return prev && span.first < prev.span.first && span.last === prev.span.last
    ? barCount - prev.barCount
    : 0;
}

// 제한을 거친 변환 t가 기간 범위 home에서 벗어났거나 돌아왔을 때의 다음 상태.
// away는 벗어났다고 알린 제스처다. 범위 끝에서 더 밀어 그대로면 t가 home과 같아 알리지 않는다.
// 알릴 것이 없으면 undefined, 있으면 새 away(돌아오면 null)
export const nextAway = (
  t: Transform,
  home: Transform,
  gesture: ChartGesture | null,
  away: ChartGesture | null,
): ChartGesture | null | undefined => {
  'worklet';
  const sameK = near(t.k, home.k);
  if (sameK && near(t.tx, home.tx)) return away === null ? undefined : null;
  if (gesture !== null && away === null) return gesture;
  // 드래그로 벗어난 뒤 핀치로 배율까지 바꿨다
  if (gesture === 'zoom' && away === 'pan' && !sameK) return 'zoom';
  return undefined;
};

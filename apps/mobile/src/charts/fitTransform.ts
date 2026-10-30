// 변환 행렬 보정(D-056). 라이브러리 제스처는 x만 바꾸고, 이 함수가
// x 범위를 제한하고 보이는 봉의 고가·저가로 y 배율·이동을 다시 정한다.
// log 축도 픽셀 공간에서는 선형이라 y는 배율·이동만으로 맞출 수 있다.

// 변환 전(기본) 픽셀 좌표의 봉 위치. 봉 x 간격은 일정하다.
export type CandleGeom = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  x0: number;
  dx: number;
  highY: number[];
  lowY: number[];
};

export type Transform = { k: number; tx: number; ky: number; ty: number };

// 최대 확대에서도 보이는 최소 봉 수
export const MIN_VISIBLE_BARS = 20;
// 위·아래 여백(차트 높이 대비)
const Y_PADDING = 0.06;

const clamp = (v: number, lo: number, hi: number) => {
  'worklet';
  return Math.min(Math.max(v, lo), hi);
};

// 화면 [left, right]에 보이는 봉 n개 중 인덱스 범위 [i0, i1]
export function indexRange(
  left: number,
  right: number,
  x0: number,
  dx: number,
  n: number,
  k: number,
  tx: number,
): [number, number] {
  'worklet';
  const xb0 = (left - tx) / k;
  const xb1 = (right - tx) / k;
  const i0 = clamp(Math.floor((xb0 - x0) / dx), 0, n - 1);
  const i1 = clamp(Math.ceil((xb1 - x0) / dx), 0, n - 1);
  return [i0, i1];
}

export function visibleRange(g: CandleGeom, k: number, tx: number): [number, number] {
  'worklet';
  return indexRange(g.left, g.right, g.x0, g.dx, g.highY.length, k, tx);
}

// x 배율·이동 제한. 축소는 '전체'(k=1)까지, 확대는 최소 봉 수까지, 이동은 데이터 시작부터 끝까지
export function clampX(
  n: number,
  left: number,
  right: number,
  k0: number,
  tx0: number,
): { k: number; tx: number } {
  'worklet';
  const k = clamp(k0, 1, Math.max(1, n / MIN_VISIBLE_BARS));
  return { k, tx: clamp(tx0, right * (1 - k), left * (1 - k)) };
}

export function fitTransform(g: CandleGeom, k0: number, tx0: number): Transform {
  'worklet';
  const { k, tx } = clampX(g.highY.length, g.left, g.right, k0, tx0);

  const [i0, i1] = visibleRange(g, k, tx);
  let yTop = Infinity;
  let yBottom = -Infinity;
  for (let i = i0; i <= i1; i++) {
    const h = g.highY[i];
    const l = g.lowY[i];
    if (h < yTop) yTop = h;
    if (l > yBottom) yBottom = l;
  }
  const span = Math.max(yBottom - yTop, 1e-6);
  const pad = (g.bottom - g.top) * Y_PADDING;
  const ky = (g.bottom - g.top - 2 * pad) / span;
  const ty = g.top + pad - ky * yTop;
  return { k, tx, ky, ty };
}

// 마지막 barCount개 봉이 보이도록 하는 x 변환(기간 버튼 동작)
export function periodTransform(g: CandleGeom, barCount: number): Transform {
  'worklet';
  const n = g.highY.length;
  const k = n / Math.max(barCount, 1);
  return fitTransform(g, k, g.right * (1 - k));
}

// 과거 봉 shift개를 앞에 붙인 뒤에도 보던 봉 범위가 같은 화면 위치에 오도록 하는 x 배율·이동(D-104).
// 봉 수가 바뀌면 변환 전 봉 간격(dx)도 바뀌므로 보던 범위를 소수 봉 순번으로 옮겨 다시 맞춘다
export function shiftedView(
  prev: CandleGeom,
  next: CandleGeom,
  shift: number,
  k: number,
  tx: number,
): { k: number; tx: number } {
  'worklet';
  const f0 = ((prev.left - tx) / k - prev.x0) / prev.dx + shift;
  const f1 = ((prev.right - tx) / k - prev.x0) / prev.dx + shift;
  const k2 = (next.right - next.left) / ((f1 - f0) * next.dx);
  return { k: k2, tx: next.left - k2 * (next.x0 + f0 * next.dx) };
}

// 핀치 시작 때의 x 배율·이동과 두 손가락 가운데(화면 x)
export type PinchStart = { k: number; tx: number; focalX: number };

// 핀치 시작 때 손가락 가운데 있던 지점이 지금 손가락 가운데에 오도록 확대·축소한다.
// 배율을 먼저 제한해야 최대·최소 배율에서 더 벌리거나 오므려도 화면이 밀리지 않는다
export function pinchTransform(
  g: CandleGeom,
  start: PinchStart,
  scale: number,
  focalX: number,
): Transform {
  'worklet';
  const n = g.highY.length;
  const k = clamp(start.k * scale, 1, Math.max(1, n / MIN_VISIBLE_BARS));
  const anchor = (start.focalX - start.tx) / start.k;
  return fitTransform(g, k, focalX - anchor * k);
}

// 변환 행렬 보정(D-032 스파이크). 라이브러리 제스처는 x만 바꾸고, 이 함수가
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

// 화면에 보이는 봉의 인덱스 범위 [i0, i1]
export function visibleRange(g: CandleGeom, k: number, tx: number): [number, number] {
  'worklet';
  const n = g.highY.length;
  const xb0 = (g.left - tx) / k;
  const xb1 = (g.right - tx) / k;
  const i0 = clamp(Math.floor((xb0 - g.x0) / g.dx), 0, n - 1);
  const i1 = clamp(Math.ceil((xb1 - g.x0) / g.dx), 0, n - 1);
  return [i0, i1];
}

export function fitTransform(g: CandleGeom, k0: number, tx0: number): Transform {
  'worklet';
  const n = g.highY.length;
  // 축소는 '전체'(k=1)까지, 확대는 최소 봉 수까지
  const k = clamp(k0, 1, Math.max(1, n / MIN_VISIBLE_BARS));
  // 이동은 데이터 시작부터 끝까지
  const tx = clamp(tx0, g.right * (1 - k), g.left * (1 - k));

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

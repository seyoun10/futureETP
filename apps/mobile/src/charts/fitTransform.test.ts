import {
  fitTransform,
  MIN_VISIBLE_BARS,
  periodTransform,
  pinchTransform,
  shiftedView,
  visibleRange,
} from './fitTransform';
import type { CandleGeom } from './fitTransform';

// 봉 100개, x 0~1000(간격 10), y 0~500
function makeGeom(): CandleGeom {
  const n = 100;
  return {
    left: 0,
    right: 1000,
    top: 0,
    bottom: 500,
    x0: 5,
    dx: 10,
    // 뒤로 갈수록 가격이 올라 y 픽셀은 작아진다
    highY: Array.from({ length: n }, (_, i) => 400 - i * 3),
    lowY: Array.from({ length: n }, (_, i) => 420 - i * 3),
  };
}

describe('fitTransform', () => {
  it('축소는 전체(k=1)까지로 제한한다', () => {
    expect(fitTransform(makeGeom(), 0.5, 0).k).toBe(1);
  });

  it('확대는 최소 봉 수까지로 제한한다', () => {
    expect(fitTransform(makeGeom(), 50, 0).k).toBe(100 / MIN_VISIBLE_BARS);
  });

  it('이동은 데이터 시작·끝을 넘지 않는다', () => {
    const g = makeGeom();
    expect(fitTransform(g, 2, 500).tx).toBeCloseTo(0);
    expect(fitTransform(g, 2, -5000).tx).toBe(-1000);
  });

  it('보이는 봉의 최고가·최저가가 여백 안에 들어가게 y를 맞춘다', () => {
    const g = makeGeom();
    const t = fitTransform(g, 2, -1000); // 뒤쪽 절반(봉 50~99)
    const [i0, i1] = visibleRange(g, t.k, t.tx);
    expect([i0, i1]).toEqual([49, 99]);
    const topPx = t.ky * g.highY[99] + t.ty;
    const bottomPx = t.ky * g.lowY[49] + t.ty;
    expect(topPx).toBeCloseTo(30);
    expect(bottomPx).toBeCloseTo(470);
  });

  it('기간 변환은 마지막 봉들을 오른쪽 끝에 맞춘다', () => {
    const t = periodTransform(makeGeom(), 25);
    expect(t.k).toBe(4);
    expect(t.tx).toBe(-3000);
  });
});

describe('pinchTransform', () => {
  // 화면 x를 변환 전 x로
  const toBase = (x: number, k: number, tx: number) => (x - tx) / k;

  it('손가락 가운데 있던 지점을 그 자리에 두고 확대한다', () => {
    const g = makeGeom();
    const start = { k: 2, tx: -500, focalX: 300 };
    const t = pinchTransform(g, start, 1.5, 300);
    expect(t.k).toBe(3);
    expect(toBase(300, t.k, t.tx)).toBeCloseTo(toBase(300, start.k, start.tx));
  });

  it('두 손가락이 함께 움직이면 그 지점이 손가락을 따라간다', () => {
    const g = makeGeom();
    const start = { k: 2, tx: -500, focalX: 300 };
    const t = pinchTransform(g, start, 1, 350);
    expect(t.k).toBe(2);
    expect(toBase(350, t.k, t.tx)).toBeCloseTo(toBase(300, start.k, start.tx));
  });

  it('최대 배율에서 더 벌려도 화면이 밀리지 않는다', () => {
    const g = makeGeom();
    const max = 100 / MIN_VISIBLE_BARS;
    const start = { k: max, tx: -2000, focalX: 400 };
    const t = pinchTransform(g, start, 3, 400);
    expect(t.k).toBe(max);
    expect(t.tx).toBeCloseTo(start.tx);
  });
});

describe('shiftedView', () => {
  it('앞에 봉이 붙어도 보던 봉(날짜) 범위를 같은 화면 위치에 둔다', () => {
    const prev = makeGeom();
    // 보던 범위: 봉 50~99 근처(k=2, 오른쪽 끝)
    const k = 2;
    const tx = prev.right * (1 - k);
    const before = visibleRange(prev, k, tx);
    // 봉 100개를 앞에 붙여 200개가 되면 같은 폭에 간격이 절반이다
    const next = {
      ...makeGeom(),
      x0: 2.5,
      dx: 5,
      highY: new Array(200).fill(0),
      lowY: new Array(200).fill(0),
    };
    const view = shiftedView(prev, next, 100, k, tx);
    expect(view.k).toBeCloseTo(4);
    expect(visibleRange(next, view.k, view.tx)).toEqual([before[0] + 100, before[1] + 100]);
  });

  it('폭이 바뀌어도(회전) 보던 봉 범위를 유지한다', () => {
    const prev = makeGeom();
    // 보던 범위: 가운데쯤(k=4)
    const k = 4;
    const tx = -1500;
    const before = visibleRange(prev, k, tx);
    // 가로로 돌려 폭이 2.2배가 되면 봉 간격도 2.2배다
    const next = { ...makeGeom(), right: 2200, x0: 11, dx: 22 };
    const view = shiftedView(prev, next, 0, k, tx);
    expect(visibleRange(next, view.k, view.tx)).toEqual(before);
    // 픽셀 이동값을 그대로 쓰면 과거 쪽으로 밀린다(이전 동작)
    expect(visibleRange(next, k, tx)[0]).toBeLessThan(before[0]);
  });
});

import { fitTransform, MIN_VISIBLE_BARS, periodTransform, visibleRange } from './fitTransform';
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

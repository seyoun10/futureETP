import { lineSample } from './lineSampling';

// 봉 1000개, 변환 전 x 0~1000(간격 1), 화면 0~400
describe('lineSample', () => {
  it('확대해 일부만 보이면 그 구간과 앞뒤 1봉만 고른다', () => {
    // k=4: 봉 하나가 4px, 화면에 100봉. tx로 봉 500부터 보이게
    expect(lineSample(1000, 0, 1, 4, -2000, 0, 400)).toEqual({ first: 499, last: 601, step: 1 });
  });

  it('봉 간격이 1px보다 좁으면 2의 거듭제곱으로 건너뛴다', () => {
    // 전체를 400px에 그리면 봉 간격 0.4px → 2봉마다 (0.8px)
    expect(lineSample(1000, 0, 0.4, 1, 0, 0, 400)).toEqual({ first: 0, last: 999, step: 2 });
    // 0.1px → 8봉마다
    expect(lineSample(1000, 0, 0.1, 1, 0, 0, 100)?.step).toBe(8);
  });

  it('건너뛸 때 시작 순번은 간격의 배수라 드래그해도 같은 점을 고른다', () => {
    const a = lineSample(4000, 0, 0.1, 2, -150, 0, 400);
    const b = lineSample(4000, 0, 0.1, 2, -150.3, 0, 400);
    expect(a?.step).toBe(4);
    expect((a?.first ?? 1) % 4).toBe(0);
    expect((b?.first ?? 1) % 4).toBe(0);
  });

  it('봉이 없으면 그리지 않는다', () => {
    expect(lineSample(0, 0, 1, 1, 0, 0, 400)).toBeNull();
  });
});

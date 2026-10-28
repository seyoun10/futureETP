import { labelStride, niceTicks, slotAt, tickDecimals } from './curveLayout';

describe('niceTicks', () => {
  it('1·2·5 간격으로 범위 안 눈금을 만든다', () => {
    expect(niceTicks(2.7, 3.5, 5)).toEqual([2.8, 3, 3.2, 3.4]);
    expect(niceTicks(61.3, 74.9, 6)).toEqual([62, 64, 66, 68, 70, 72, 74]);
    expect(niceTicks(2400, 2600, 5)).toEqual([2400, 2450, 2500, 2550, 2600]);
  });

  it('값이 하나면 그 값 하나다', () => {
    expect(niceTicks(70, 70, 5)).toEqual([70]);
  });
});

describe('tickDecimals', () => {
  it('간격에 맞추되 가격 자릿수를 넘지 않는다', () => {
    expect(tickDecimals([2.8, 3, 3.2], 3)).toBe(1);
    expect(tickDecimals([2400, 2450], 1)).toBe(0);
    expect(tickDecimals([2.905, 2.91], 2)).toBe(2);
    expect(tickDecimals([70], 2)).toBe(2);
  });
});

describe('labelStride', () => {
  it('칸이 라벨보다 좁으면 건너뛴다', () => {
    expect(labelStride(40, 30)).toBe(1);
    expect(labelStride(14, 30)).toBe(3);
  });
});

describe('slotAt', () => {
  it('누른 x의 칸을 고르고 칸 밖은 null이다', () => {
    expect(slotAt(45, 40, 20, 3)).toBe(0);
    expect(slotAt(99, 40, 20, 3)).toBe(2);
    expect(slotAt(39, 40, 20, 3)).toBeNull();
    expect(slotAt(100, 40, 20, 3)).toBeNull();
  });
});

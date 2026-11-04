import { labelStride, niceTicks, nearestSlot, placePctLabels, tickDecimals } from './curveLayout';

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

describe('nearestSlot', () => {
  it('x의 칸을 고르고 칸 밖은 양끝 칸이다', () => {
    expect(nearestSlot(45, 40, 20, 3)).toBe(0);
    expect(nearestSlot(99, 40, 20, 3)).toBe(2);
    expect(nearestSlot(39, 40, 20, 3)).toBe(0);
    expect(nearestSlot(100, 40, 20, 3)).toBe(2);
    expect(nearestSlot(50, 40, 20, 0)).toBeNull();
  });
});

describe('placePctLabels', () => {
  const options = { height: 10, gap: 4, minY: 0, maxY: 200 };

  it('겹치지 않으면 모두 점 위에 둔다', () => {
    expect(
      placePctLabels(
        [
          { x: 0, width: 30, top: 100, bottom: 110 },
          { x: 40, width: 30, top: 100, bottom: 110 },
        ],
        options,
      ),
    ).toEqual([96, 96]);
  });

  it('이웃과 겹치면 점 아래, 그다음 한 줄 위로 옮긴다', () => {
    expect(
      placePctLabels(
        [
          { x: 0, width: 30, top: 100, bottom: 110 },
          { x: 20, width: 30, top: 100, bottom: 110 },
          { x: 10, width: 30, top: 100, bottom: 110 },
        ],
        options,
      ),
    ).toEqual([96, 124, 82]);
  });

  it('하락(below)은 점 아래가 먼저고, 겹치면 점 위 → 한 줄 더 아래 순이다', () => {
    expect(
      placePctLabels(
        [
          { x: 0, width: 30, top: 100, bottom: 110, below: true },
          { x: 40, width: 30, top: 100, bottom: 110 },
          { x: 20, width: 30, top: 100, bottom: 110, below: true },
        ],
        options,
      ),
    ).toEqual([124, 96, 138]);
  });

  it('범위 밖 자리는 건너뛰고 자리가 없으면 점 위다', () => {
    const tight = { ...options, minY: 90, maxY: 120 };
    expect(
      placePctLabels(
        [
          { x: 0, width: 30, top: 100, bottom: 110 },
          { x: 10, width: 30, top: 100, bottom: 110 },
        ],
        tight,
      ),
    ).toEqual([96, 96]);
  });
});

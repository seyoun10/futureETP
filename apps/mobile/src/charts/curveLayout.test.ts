import {
  labelStride,
  niceTicks,
  nearestSlot,
  placePctLabels,
  segmentHitsBox,
  tickDecimals,
} from './curveLayout';

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
          { x: 0, anchor: 15, width: 30, top: 100, bottom: 110 },
          { x: 40, anchor: 55, width: 30, top: 100, bottom: 110 },
        ],
        options,
      ).map((p) => p.y),
    ).toEqual([96, 96]);
  });

  it('이웃과 겹치면 반대쪽으로 넘기지 않고 같은 쪽 바깥으로 밀어낸다', () => {
    expect(
      placePctLabels(
        [
          { x: 0, anchor: 15, width: 30, top: 100, bottom: 110 },
          { x: 20, anchor: 35, width: 30, top: 100, bottom: 110 },
          { x: 10, anchor: 25, width: 30, top: 100, bottom: 110 },
        ],
        options,
      ).map((p) => p.y),
    ).toEqual([96, 82, 68]);
  });

  it('하락(below)은 점 아래에 두고, 겹치면 더 아래로 민다', () => {
    expect(
      placePctLabels(
        [
          { x: 0, anchor: 15, width: 30, top: 100, bottom: 110, below: true },
          { x: 40, anchor: 55, width: 30, top: 100, bottom: 110 },
          { x: 20, anchor: 35, width: 30, top: 100, bottom: 110, below: true },
        ],
        options,
      ).map((p) => p.y),
    ).toEqual([124, 96, 138]);
  });

  it('위·아래 라벨은 가로로 겹쳐도 서로 밀지 않는다', () => {
    expect(
      placePctLabels(
        [
          { x: 0, anchor: 15, width: 30, top: 100, bottom: 110 },
          { x: 10, anchor: 25, width: 30, top: 100, bottom: 110, below: true },
        ],
        options,
      ).map((p) => p.y),
    ).toEqual([96, 124]);
  });

  it('밀려서 범위를 벗어나면 그 끝에 붙인다', () => {
    const tight = { ...options, minY: 80, maxY: 120 };
    expect(
      placePctLabels(
        [
          { x: 0, anchor: 15, width: 30, top: 100, bottom: 110 },
          { x: 10, anchor: 25, width: 30, top: 100, bottom: 110 },
        ],
        tight,
      ).map((p) => p.y),
    ).toEqual([96, 90]);
  });

  it('선과 겹치면 점 x가 글자 안에 남는 만큼 좌우로 가장 덜 민다', () => {
    // 점(15, 100)에서 오른쪽 위로 오르는 선: 위 라벨은 왼쪽으로 비킨다
    const segments = [{ x0: 15, y0: 100, x1: 45, y1: 70 }];
    const [p] = placePctLabels([{ x: 0, anchor: 15, width: 30, top: 97, bottom: 103 }], {
      ...options,
      minX: -100,
      segments,
    });
    expect(p.y).toBe(93);
    expect(p.x).toBeLessThan(0);
    expect(p.x).toBeGreaterThanOrEqual(-15);
  });

  it('비킬 자리가 없으면 그대로 둔다', () => {
    // 점 양쪽으로 가파르게 오르는 골짜기
    const segments = [
      { x0: -15, y0: 0, x1: 15, y1: 100 },
      { x0: 15, y0: 100, x1: 45, y1: 0 },
    ];
    expect(
      placePctLabels([{ x: 0, anchor: 15, width: 30, top: 97, bottom: 103 }], {
        ...options,
        minX: -100,
        segments,
      }),
    ).toEqual([{ x: 0, y: 93 }]);
  });

  it('왼쪽 끝을 넘어 밀지 않는다', () => {
    const segments = [{ x0: 15, y0: 100, x1: 45, y1: 70 }];
    expect(
      placePctLabels([{ x: 0, anchor: 15, width: 30, top: 97, bottom: 103 }], {
        ...options,
        minX: 0,
        segments,
      }),
    ).toEqual([{ x: 0, y: 93 }]);
  });
});

describe('segmentHitsBox', () => {
  it('상자 x 구간 안 선분의 세로 범위로 판정한다', () => {
    const s = { x0: 0, y0: 0, x1: 10, y1: 10 };
    expect(segmentHitsBox(s, 4, 6, 3, 7)).toBe(true);
    expect(segmentHitsBox(s, 4, 6, 7, 9)).toBe(false);
    expect(segmentHitsBox(s, 11, 20, 0, 10)).toBe(false);
  });
});

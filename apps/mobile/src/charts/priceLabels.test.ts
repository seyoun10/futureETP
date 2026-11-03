import { clampLabelY, overlapsAny, stackLabels } from './priceLabels';

describe('clampLabelY', () => {
  it('차트 안쪽 반 높이 범위로 자른다', () => {
    expect(clampLabelY(0, 14, 0, 500)).toBe(7);
    expect(clampLabelY(250, 14, 0, 500)).toBe(250);
    expect(clampLabelY(500, 14, 0, 500)).toBe(493);
  });
});

describe('overlapsAny', () => {
  it('라벨 높이보다 가까우면 겹친다', () => {
    expect(overlapsAny(110, [{ y: 100 }], 14)).toBe(true);
    expect(overlapsAny(114, [{ y: 100 }], 14)).toBe(false);
  });
});

describe('stackLabels', () => {
  it('겹치는 라벨을 빼지 않고 아래로 민다', () => {
    const labels = [
      { key: 'b', y: 105 },
      { key: 'a', y: 100 },
      { key: 'c', y: 200 },
    ];
    expect(stackLabels(labels, 14, 0, 500)).toEqual([
      { key: 'a', y: 100 },
      { key: 'b', y: 114 },
      { key: 'c', y: 200 },
    ]);
  });

  it('아래 끝을 넘으면 위로 되민다', () => {
    const labels = [
      { key: 'a', y: 490 },
      { key: 'b', y: 495 },
      { key: 'c', y: 500 },
    ];
    expect(stackLabels(labels, 14, 0, 500).map((l) => l.y)).toEqual([465, 479, 493]);
  });

  it('차트 위·아래 밖 라벨은 빼고, 입력을 바꾸지 않는다', () => {
    const labels = [
      { key: 'above', y: -5 },
      { key: 'in', y: 50 },
      { key: 'in2', y: 55 },
    ];
    expect(stackLabels(labels, 14, 0, 500).map((l) => l.key)).toEqual(['in', 'in2']);
    expect(labels[2].y).toBe(55);
  });
});

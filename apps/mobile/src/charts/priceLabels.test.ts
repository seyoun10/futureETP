import { overlapsAny, placeLabels } from './priceLabels';

describe('placeLabels', () => {
  it('우선순위 순으로 놓고, 앞 라벨과 겹치는 라벨은 뺀다', () => {
    const labels = [
      { key: 'current', y: 100 },
      { key: 'a', y: 108 },
      { key: 'b', y: 120 },
      { key: 'c', y: 125 },
    ];
    expect(placeLabels(labels, 14, 0, 500).map((l) => l.key)).toEqual(['current', 'b']);
  });

  it('차트 위·아래 밖 라벨은 뺀다', () => {
    const labels = [
      { key: 'above', y: -5 },
      { key: 'in', y: 50 },
      { key: 'below', y: 501 },
    ];
    expect(placeLabels(labels, 14, 0, 500).map((l) => l.key)).toEqual(['in']);
  });
});

describe('overlapsAny', () => {
  it('라벨 높이보다 가까우면 겹친다', () => {
    expect(overlapsAny(110, [{ y: 100 }], 14)).toBe(true);
    expect(overlapsAny(114, [{ y: 100 }], 14)).toBe(false);
  });
});

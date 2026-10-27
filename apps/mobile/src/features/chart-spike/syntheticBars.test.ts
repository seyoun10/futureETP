import { makeSyntheticBars } from './syntheticBars';

describe('makeSyntheticBars', () => {
  it('요청한 개수의 거래일 봉을 만든다', () => {
    const bars = makeSyntheticBars(4000);
    expect(bars).toHaveLength(4000);
    expect(bars[0]?.date).toBe('2010-06-01');
    for (const bar of bars) {
      const weekday = new Date(`${bar.date}T00:00:00Z`).getUTCDay();
      expect(weekday).not.toBe(0);
      expect(weekday).not.toBe(6);
    }
  });

  it('고가·저가가 시가·종가를 감싸고 모두 양수다(log 축)', () => {
    for (const bar of makeSyntheticBars(4000)) {
      expect(bar.low).toBeGreaterThan(0);
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close));
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close));
    }
  });

  it('같은 시드면 같은 봉을 만든다', () => {
    expect(makeSyntheticBars(100, 7)).toEqual(makeSyntheticBars(100, 7));
  });
});

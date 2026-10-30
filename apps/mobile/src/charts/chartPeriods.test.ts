import { nearestPeriod, PERIOD_BARS } from './chartPeriods';

describe('nearestPeriod', () => {
  it('보이는 봉 수와 비율이 가장 가까운 기간을 고른다', () => {
    expect(nearestPeriod(PERIOD_BARS['6M'], 4000)).toBe('6M');
    expect(nearestPeriod(140, 4000)).toBe('6M');
    expect(nearestPeriod(30, 4000)).toBe('2M');
  });

  it('가장 긴 기간보다 넓게 보면 12M이다', () => {
    expect(nearestPeriod(1000, 4000)).toBe('12M');
  });

  it('전체 봉 수보다 긴 기간은 전체 봉 수로 줄여 보고, 같으면 짧은 기간을 고른다', () => {
    // 봉 150개: 8M(168)·10M·12M은 모두 150개로 같다
    expect(nearestPeriod(150, 150)).toBe('8M');
    expect(nearestPeriod(120, 150)).toBe('6M');
  });
});

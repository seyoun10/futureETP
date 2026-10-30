import { nearestPeriod, PERIOD_BARS } from './chartPeriods';

describe('nearestPeriod', () => {
  it('보이는 봉 수와 비율이 가장 가까운 기간을 고른다', () => {
    expect(nearestPeriod(PERIOD_BARS['6M'], 4000)).toBe('6M');
    expect(nearestPeriod(140, 4000)).toBe('6M');
    expect(nearestPeriod(700, 4000)).toBe('2Y');
  });

  it('전체 봉 수 이상인 기간은 전체로 본다', () => {
    // 봉 2,000개: 8Y(2,016)·10Y(2,520)는 전체와 같은 범위
    expect(nearestPeriod(2000, 2000)).toBe('ALL');
    expect(nearestPeriod(1600, 2000)).toBe('6Y');
  });
});

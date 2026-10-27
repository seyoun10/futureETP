import { monthTicks } from './monthTicks';

// 2010-06-01부터 평일 4,000개(휴장일은 무시)
function weekdays(count: number): string[] {
  const dates: string[] = [];
  const d = new Date(Date.UTC(2010, 5, 1));
  while (dates.length < count) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) dates.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return dates;
}

const dates = weekdays(4000);

describe('monthTicks', () => {
  it('짧은 구간은 매월 눈금을 단다', () => {
    const i0 = dates.findIndex((d) => d >= '2010-11-01');
    const i1 = dates.findIndex((d) => d >= '2011-03-15');
    expect(monthTicks(dates, i0, i1).map((t) => [t.year, t.month])).toEqual([
      [2010, 11],
      [2010, 12],
      [2011, 1],
      [2011, 2],
      [2011, 3],
    ]);
  });

  it('긴 구간도 최대 눈금 수를 넘지 않는다', () => {
    const ticks = monthTicks(dates, 0, dates.length - 1);
    expect(ticks.length).toBeGreaterThan(0);
    expect(ticks.length).toBeLessThanOrEqual(5);
  });

  it('눈금은 그 달의 첫 거래일에 놓인다', () => {
    for (const t of monthTicks(dates, 0, 500)) {
      expect(dates[t.index]?.slice(0, 7)).not.toBe(dates[t.index - 1]?.slice(0, 7));
    }
  });
});

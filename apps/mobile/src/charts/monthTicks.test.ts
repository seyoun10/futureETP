import type { TFunction } from 'i18next';

import { monthTickLabel, monthTicks } from './monthTicks';

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
  it('라벨이 들어갈 만큼 넓으면 매월 눈금을 단다', () => {
    const i0 = dates.findIndex((d) => d >= '2010-11-01');
    const i1 = dates.findIndex((d) => d >= '2011-03-15');
    expect(monthTicks(dates, i0, i1, 10).map((t) => [t.year, t.month])).toEqual([
      [2010, 11],
      [2010, 12],
      [2011, 1],
      [2011, 2],
      [2011, 3],
    ]);
  });

  it('이웃 눈금이 minGap보다 가까우면 간격을 넓힌다(1월은 남는다)', () => {
    const i0 = dates.findIndex((d) => d >= '2010-11-01');
    const i1 = dates.findIndex((d) => d >= '2011-08-15');
    expect(monthTicks(dates, i0, i1, 30).map((t) => [t.year, t.month])).toEqual([
      [2010, 11],
      [2011, 1],
      [2011, 3],
      [2011, 5],
      [2011, 7],
    ]);
  });

  it('긴 구간도 이웃 눈금이 minGap 이상 떨어진다', () => {
    const ticks = monthTicks(dates, 0, dates.length - 1, 300);
    expect(ticks.length).toBeGreaterThan(0);
    ticks.slice(1).forEach((t, j) => expect(t.index - ticks[j].index).toBeGreaterThanOrEqual(300));
  });

  it('눈금은 그 달의 첫 거래일에 놓인다', () => {
    for (const t of monthTicks(dates, 0, 500, 1)) {
      expect(dates[t.index]?.slice(0, 7)).not.toBe(dates[t.index - 1]?.slice(0, 7));
    }
  });
});

describe('monthTickLabel', () => {
  const t = ((key: string) => `m${key.split('.').pop()}`) as unknown as TFunction;

  it('1월은 연도, 나머지는 월 이름', () => {
    expect(monthTickLabel(t, 2027, 1)).toBe('2027');
    expect(monthTickLabel(t, 2027, 3)).toBe('m3');
  });
});

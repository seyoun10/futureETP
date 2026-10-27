import { monthTicks } from './monthTicks';
import { makeSyntheticBars } from './syntheticBars';

const dates = makeSyntheticBars(4000).map((b) => b.date);

describe('monthTicks', () => {
  it('짧은 구간은 매월 눈금을 달고 1월은 연도로 쓴다', () => {
    // 2010-11 ~ 2011-03 언저리
    const i0 = dates.findIndex((d) => d >= '2010-11-01');
    const i1 = dates.findIndex((d) => d >= '2011-03-15');
    expect(monthTicks(dates, i0, i1).map((t) => t.label)).toEqual([
      '11월',
      '12월',
      '2011',
      '2월',
      '3월',
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

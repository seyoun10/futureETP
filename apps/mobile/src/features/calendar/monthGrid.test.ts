import { localDateKey, monthCells, monthsFrom, monthsRange, weekdayOf } from './monthGrid';

describe('monthGrid', () => {
  it('오늘이 속한 달부터 3개월이고 연도를 넘긴다', () => {
    const months = monthsFrom(new Date(2026, 10, 21, 9), 3);
    expect(months).toEqual([
      { year: 2026, month: 11 },
      { year: 2026, month: 12 },
      { year: 2027, month: 1 },
    ]);
    expect(monthsRange(months)).toEqual({ from: '2026-11-01', to: '2027-01-31' });
  });

  it('말일에 열어도 다음 달을 건너뛰지 않는다', () => {
    expect(monthsFrom(new Date(2027, 0, 31), 2)).toEqual([
      { year: 2027, month: 1 },
      { year: 2027, month: 2 },
    ]);
    expect(monthsRange([{ year: 2028, month: 2 }]).to).toBe('2028-02-29');
  });

  it('칸은 일요일 시작이고 앞뒤를 빈칸으로 채운다', () => {
    // 2026-11-01은 일요일, 30일은 월요일
    const nov = monthCells({ year: 2026, month: 11 });
    expect(nov[0]).toBe('2026-11-01');
    expect(nov).toHaveLength(35);
    expect(nov[29]).toBe('2026-11-30');
    expect(nov.slice(30)).toEqual([null, null, null, null, null]);
    // 2027-01-01은 금요일
    const jan = monthCells({ year: 2027, month: 1 });
    expect(jan.slice(0, 6)).toEqual([null, null, null, null, null, '2027-01-01']);
    expect(jan.length % 7).toBe(0);
  });

  it('로컬 날짜 키와 요일', () => {
    expect(localDateKey(new Date(2026, 10, 21, 23, 59))).toBe('2026-11-21');
    expect(weekdayOf('2026-11-26')).toBe(4);
  });

  it('빈 목록의 범위는 실패한다', () => {
    expect(() => monthsRange([])).toThrow();
  });
});

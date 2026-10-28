import { describe, expect, it, vi } from 'vitest';
import { createCalendarHandler, missingCalendarYears } from './calendar.ts';

describe('missingCalendarYears', () => {
  it('60일 뒤가 같은 해면 그해만 본다', () => {
    expect(missingCalendarYears('2026-10-28', [2026])).toEqual([]);
    expect(missingCalendarYears('2026-10-28', [])).toEqual([2026]);
  });

  it('60일 뒤가 다음 해면 다음 해 달력도 있어야 한다', () => {
    expect(missingCalendarYears('2026-11-02', [2026])).toEqual([2027]);
    expect(missingCalendarYears('2026-11-02', [2026, 2027])).toEqual([]);
  });

  it('11/1까지는 60일 뒤가 12/31이라 다음 해를 보지 않는다', () => {
    expect(missingCalendarYears('2026-11-01', [2026])).toEqual([]);
  });
});

describe('createCalendarHandler', () => {
  it('CT 날짜로 연도 범위를 묻고, 빠진 연도가 있으면 실패한다', async () => {
    const store = { yearsWithTradingDays: vi.fn(() => Promise.resolve([2026])) };
    const handler = createCalendarHandler({ store, log: vi.fn() });

    // 2026-11-02 03:00 UTC = 11/1 21:00 CT(CST) → 60일 뒤 12/31
    await handler({ now: new Date('2026-11-02T03:00:00Z') });
    expect(store.yearsWithTradingDays).toHaveBeenLastCalledWith(2026, 2026);

    // 11/2 16:15 CT → 60일 뒤 2027-01-01
    await expect(handler({ now: new Date('2026-11-02T22:15:00Z') })).rejects.toThrow(
      'trading calendar missing for 2027 (through 2027-01-01)',
    );
    expect(store.yearsWithTradingDays).toHaveBeenLastCalledWith(2026, 2027);
  });
});

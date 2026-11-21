import type { Calendar } from '@futureetp/shared';
import { calendarStaleTime, MISSING_STALE_MS } from './useMarketCalendar';

const calendar = (missing: Calendar['missing']): Calendar => ({
  from: '2027-01-01',
  to: '2027-03-31',
  exceptions: [],
  missing,
});

describe('calendarStaleTime', () => {
  it('입력되지 않은 연도가 있으면 짧게 둔다', () => {
    const data = calendar([{ market: 'KRX', year: 2027 }]);
    expect(calendarStaleTime({ state: { data } })).toBe(MISSING_STALE_MS);
  });

  it('모두 입력됐으면 예외가 없어도 오래 둔다', () => {
    expect(calendarStaleTime({ state: { data: calendar([]) } })).toBeGreaterThan(MISSING_STALE_MS);
  });

  it('데이터가 없으면 오래 둔다(조회 전에는 staleTime이 쓰이지 않는다)', () => {
    expect(calendarStaleTime({ state: {} })).toBeGreaterThan(MISSING_STALE_MS);
  });
});

// 거래일 달력 점검 CALENDAR(D-047, D-061). 매일 16:15 CT에 앞으로 60일이 걸친 연도의 trading_day 행이 있는지 본다.
// 휴장일은 행이 없어 날짜 하나하나로는 누락과 구분되지 않는다. 입력은 연도 단위(`calendar:import <연도>`)라
// 연도에 행이 하나라도 있으면 입력된 것으로 본다. 빠진 연도가 있으면 작업이 실패하고, 재시도까지 실패하면
// 스케줄러가 운영 알림을 보낸다(D-045). 거래일 없는 작업이라 다시 성공할 때까지 1회만 알린다(D-048).
import { addDays, CME_TIME_ZONE, dateInZone } from '../calc/tradingCalendar.ts';
import type { JobHandler } from './runner.ts';

export const CALENDAR_HORIZON_DAYS = 60;

export interface CalendarStore {
  // from~to 연도 중 trading_day 행이 있는 연도
  yearsWithTradingDays(fromYear: number, toYear: number): Promise<number[]>;
}

// 오늘(CT)부터 60일 뒤까지가 걸친 연도 중 행이 없는 연도
export function missingCalendarYears(today: string, presentYears: readonly number[]): number[] {
  const fromYear = Number(today.slice(0, 4));
  const toYear = Number(addDays(today, CALENDAR_HORIZON_DAYS).slice(0, 4));
  const years: number[] = [];
  for (let year = fromYear; year <= toYear; year++) {
    if (!presentYears.includes(year)) years.push(year);
  }
  return years;
}

export function createCalendarHandler({
  store,
  log = console.log,
}: {
  store: CalendarStore;
  log?: (message: string) => void;
}): JobHandler {
  return async (ctx) => {
    const today = dateInZone(ctx.now, CME_TIME_ZONE);
    const horizon = addDays(today, CALENDAR_HORIZON_DAYS);
    const present = await store.yearsWithTradingDays(
      Number(today.slice(0, 4)),
      Number(horizon.slice(0, 4)),
    );
    const missing = missingCalendarYears(today, present);
    if (missing.length > 0) {
      throw new Error(
        `trading calendar missing for ${missing.join(', ')} (through ${horizon}); ` +
          `run calendar:import <year>`,
      );
    }
    log(`[calendar] covered through ${horizon}`);
  };
}

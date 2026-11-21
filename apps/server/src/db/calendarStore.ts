// trading_day 연도(CALENDAR 점검, 흐름은 jobs/calendar.ts)와 휴장 달력 조회(api/calendar.ts)
import type { CalendarExceptionKind, CalendarMarket } from '@futureetp/shared';
import { asc, between, sql } from 'drizzle-orm';
import type { CalendarApiStore } from '../api/calendar.ts';
import type { CalendarStore } from '../jobs/calendar.ts';
import type { db as Db } from './client.ts';
import { calendarException, tradingDay } from './schema.ts';

export function createCalendarStore(db: typeof Db): CalendarStore & CalendarApiStore {
  return {
    async yearsWithTradingDays(fromYear, toYear) {
      const year = sql<number>`extract(year from ${tradingDay.tradeDate})::int`;
      const rows = await db
        .selectDistinct({ year })
        .from(tradingDay)
        .where(between(tradingDay.tradeDate, `${fromYear}-01-01`, `${toYear}-12-31`));
      return rows.map((row) => row.year);
    },

    async exceptions(from, to) {
      const rows = await db
        .select()
        .from(calendarException)
        .where(between(calendarException.date, from, to))
        .orderBy(asc(calendarException.date), asc(calendarException.market));
      // market·kind는 입력 스크립트가 shared 상수로만 넣는다
      return rows.map((r) => ({
        ...r,
        market: r.market as CalendarMarket,
        kind: r.kind as CalendarExceptionKind,
      }));
    },

    async loadedYears(fromYear, toYear) {
      const year = sql<number>`extract(year from ${calendarException.date})::int`;
      const rows = await db
        .selectDistinct({ market: calendarException.market, year })
        .from(calendarException)
        .where(between(calendarException.date, `${fromYear}-01-01`, `${toYear}-12-31`));
      return rows.map((r) => ({ market: r.market as CalendarMarket, year: r.year }));
    },
  };
}

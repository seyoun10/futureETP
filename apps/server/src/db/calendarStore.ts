// CALENDAR 점검이 읽는 trading_day 연도. 흐름은 jobs/calendar.ts
import { between, sql } from 'drizzle-orm';
import type { CalendarStore } from '../jobs/calendar.ts';
import type { db as Db } from './client.ts';
import { tradingDay } from './schema.ts';

export function createCalendarStore(db: typeof Db): CalendarStore {
  return {
    async yearsWithTradingDays(fromYear, toYear) {
      const year = sql<number>`extract(year from ${tradingDay.tradeDate})::int`;
      const rows = await db
        .selectDistinct({ year })
        .from(tradingDay)
        .where(between(tradingDay.tradeDate, `${fromYear}-01-01`, `${toYear}-12-31`));
      return rows.map((row) => row.year);
    },
  };
}

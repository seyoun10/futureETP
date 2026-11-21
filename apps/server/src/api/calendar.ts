import { CALENDAR_MARKETS, calendarQuerySchema } from '@futureetp/shared';
import type { Calendar, CalendarException, CalendarMarket } from '@futureetp/shared';
import { Hono } from 'hono';
import { parseInput } from './params.ts';
import { ok } from './response.ts';

export type CalendarApiStore = {
  // from~to(포함)의 예외 일정. 날짜, 시장 순
  exceptions: (from: string, to: string) => Promise<CalendarException[]>;
  // fromYear~toYear 중 예외 일정이 하나라도 입력된 (시장, 연도)
  loadedYears: (
    fromYear: number,
    toYear: number,
  ) => Promise<{ market: CalendarMarket; year: number }[]>;
};

// GET /v1/calendar(휴장 달력 화면). 휴일이 없는 해는 없으므로 행이 없는 (시장, 연도)는 미입력으로 알린다
export function calendarRoutes(store: CalendarApiStore) {
  const routes = new Hono();
  routes.get('/', async (c) => {
    const { from, to } = parseInput(calendarQuerySchema, c.req.query());
    const fromYear = Number(from.slice(0, 4));
    const toYear = Number(to.slice(0, 4));
    const [exceptions, loaded] = await Promise.all([
      store.exceptions(from, to),
      store.loadedYears(fromYear, toYear),
    ]);
    const loadedKeys = new Set(loaded.map((l) => `${l.market}:${l.year}`));
    const missing: Calendar['missing'] = [];
    for (const market of CALENDAR_MARKETS) {
      for (let year = fromYear; year <= toYear; year++) {
        if (!loadedKeys.has(`${market}:${year}`)) missing.push({ market, year });
      }
    }
    const data: Calendar = { from, to, exceptions, missing };
    return ok(c, data);
  });
  return routes;
}

// 거래일·휴장 달력 입력(연 1회 + 거래소 공지 때, D-047, D-061). 1회 실행 스크립트다.
// cme: scripts/calendar/<연도>.json → 그 연도의 trading_day와 calendar_exception(CME) 행을 통째로 바꾼다.
// krx·nyse: scripts/calendar/<시장>/<연도>.json → 그 연도의 calendar_exception(시장) 행만 바꾼다.
import { readFile } from 'node:fs/promises';
import type { CalendarMarket } from '@futureetp/shared';
import { and, between, eq, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { buildCalendarExceptions, buildTradingDays } from '../calc/tradingCalendar.ts';
import type { CalendarExceptionRow } from '../calc/tradingCalendar.ts';
import { db } from './client.ts';
import { calendarException, tradingDay } from './schema.ts';

const USAGE = 'Usage: npm run calendar:import -w apps/server -- <year> [cme|krx|nyse]';

const MARKET_ARGS: Record<string, CalendarMarket> = { cme: 'CME', krx: 'KRX', nyse: 'NYSE' };

const exception = z.object({ date: z.string(), note: z.string().min(1) });
const timed = exception.extend({ at: z.string() });
const cmeSchema = z.object({
  year: z.number().int(),
  closed: z.array(exception),
  halts: z.array(timed),
  earlyCloses: z.array(timed),
});
// KRX·NYSE에는 중간 정지가 없다. lateOpens는 KRX 연초·수능일 개장 지연이다.
const marketSchema = z.strictObject({
  year: z.number().int(),
  closed: z.array(exception),
  earlyCloses: z.array(timed).default([]),
  lateOpens: z.array(timed).default([]),
  // 출처·잠정 여부 메모. 입력에는 쓰지 않는다
  source: z.string().optional(),
});

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function replaceExceptions(
  tx: Tx,
  market: CalendarMarket,
  year: string,
  rows: CalendarExceptionRow[],
): Promise<void> {
  await tx
    .delete(calendarException)
    .where(
      and(
        eq(calendarException.market, market),
        between(calendarException.date, `${year}-01-01`, `${year}-12-31`),
      ),
    );
  if (rows.length > 0) await tx.insert(calendarException).values(rows);
}

async function importCme(year: string, raw: unknown): Promise<void> {
  const input = cmeSchema.parse(raw);
  if (String(input.year) !== year)
    throw new Error(`year in file is ${input.year}, expected ${year}`);
  const rows = buildTradingDays(input);
  const exceptions = buildCalendarExceptions('CME', input);

  const deleted = await db.transaction(async (tx) => {
    // 새로 생긴 휴장일처럼 입력에서 빠진 날짜는 지운다.
    const removed = await tx
      .delete(tradingDay)
      .where(
        and(
          between(tradingDay.tradeDate, `${year}-01-01`, `${year}-12-31`),
          notInArray(
            tradingDay.tradeDate,
            rows.map((r) => r.tradeDate),
          ),
        ),
      )
      .returning({ tradeDate: tradingDay.tradeDate });
    await tx
      .insert(tradingDay)
      .values(rows)
      .onConflictDoUpdate({
        target: tradingDay.tradeDate,
        set: {
          sessionOpenAt: sql`excluded.session_open_at`,
          sessionCloseAt: sql`excluded.session_close_at`,
          haltStartAt: sql`excluded.halt_start_at`,
          haltEndAt: sql`excluded.halt_end_at`,
          isEarlyClose: sql`excluded.is_early_close`,
          note: sql`excluded.note`,
        },
      });
    await replaceExceptions(tx, 'CME', year, exceptions);
    return removed.map((r) => r.tradeDate);
  });

  console.log(`[calendar ${year}] ${rows.length} trading days upserted`);
  console.log(`[calendar ${year}] CME ${exceptions.length} exceptions replaced`);
  if (deleted.length > 0) console.log(`[calendar ${year}] removed: ${deleted.join(', ')}`);
}

async function importMarket(market: CalendarMarket, year: string, raw: unknown): Promise<void> {
  const input = marketSchema.parse(raw);
  if (String(input.year) !== year)
    throw new Error(`year in file is ${input.year}, expected ${year}`);
  const exceptions = buildCalendarExceptions(market, input);
  await db.transaction((tx) => replaceExceptions(tx, market, year, exceptions));
  console.log(`[calendar ${year}] ${market} ${exceptions.length} exceptions replaced`);
}

async function main(): Promise<void> {
  const [year, marketArg = 'cme', ...rest] = process.argv.slice(2);
  const market = MARKET_ARGS[marketArg];
  if (!year || !/^\d{4}$/.test(year) || !market || rest.length > 0) throw new Error(USAGE);

  const dir = market === 'CME' ? '' : `${marketArg}/`;
  const file = new URL(`../../../../scripts/calendar/${dir}${year}.json`, import.meta.url);
  const raw: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (market === 'CME') await importCme(year, raw);
  else await importMarket(market, year, raw);
}

try {
  await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}

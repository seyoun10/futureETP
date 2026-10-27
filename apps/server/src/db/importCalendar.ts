// 거래일 달력 입력(연 1회 + CME 공지 때, D-047, D-061). 1회 실행 스크립트다.
// scripts/calendar/<연도>.json을 읽어 그 연도의 trading_day 행을 통째로 바꾼다.
import { readFile } from 'node:fs/promises';
import { and, between, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { buildTradingDays } from '../calc/tradingCalendar.ts';
import { db } from './client.ts';
import { tradingDay } from './schema.ts';

const USAGE = 'Usage: npm run calendar:import -w apps/server -- <year>';

const exception = z.object({ date: z.string(), note: z.string().min(1) });
const timed = exception.extend({ at: z.string() });
const inputSchema = z.object({
  year: z.number().int(),
  closed: z.array(exception),
  halts: z.array(timed),
  earlyCloses: z.array(timed),
});

async function main(): Promise<void> {
  const [year, ...rest] = process.argv.slice(2);
  if (!year || !/^\d{4}$/.test(year) || rest.length > 0) throw new Error(USAGE);

  const file = new URL(`../../../../scripts/calendar/${year}.json`, import.meta.url);
  const input = inputSchema.parse(JSON.parse(await readFile(file, 'utf8')));
  if (String(input.year) !== year)
    throw new Error(`year in file is ${input.year}, expected ${year}`);
  const rows = buildTradingDays(input);

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
    return removed.map((r) => r.tradeDate);
  });

  console.log(`[calendar ${year}] ${rows.length} trading days upserted`);
  if (deleted.length > 0) console.log(`[calendar ${year}] removed: ${deleted.join(', ')}`);
}

try {
  await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}

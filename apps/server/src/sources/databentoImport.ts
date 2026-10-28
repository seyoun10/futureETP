// Databento 1회 적재 2단계(D-088): 받은 CSV(databentoDownload.ts) → contract·daily_bar·과거 trading_day.
// npm run databento:import -w apps/server -- [--dry-run] [--data <폴더>]
// --dry-run은 변환 결과 통계만 출력하고 DB에 쓰지 않는다. 다시 실행하면 같은 행으로 덮어쓰고,
// 결과에 없는 Databento 봉·과거 trading_day 행(휴장일 재전송 등)은 지운다.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { createZstdDecompress } from 'node:zlib';
import { and, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm';
import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import { isTargetMonth } from '../calc/monthList.ts';
import { db } from '../db/client.ts';
import { activeMonthRule, contract, dailyBar, tradingDay } from '../db/schema.ts';
import {
  createBarBuilder,
  parseDefinition,
  type ContractInfo,
  type CsvRow,
  type LoadedBar,
} from './databentoBars.ts';

const DEFAULT_DATA = join(homedir(), 'futureetp-data', 'databento');
const INSERT_CHUNK = 5000;

// 원자재 하나의 파일. 연도별 파일, 없으면 예전 통째 파일
async function files(data: string, schema: string, code: CommodityCode): Promise<string[]> {
  const whole = join(data, schema, `${code}.csv.zst`);
  if (existsSync(whole)) return [whole];
  const dir = join(data, schema, code);
  const names = (await readdir(dir)).filter((n) => n.endsWith('.csv.zst')).sort();
  if (names.length === 0) throw new Error(`No files in ${dir}`);
  // 빈 파일은 그 기간에 상장 심볼이 없다는 표시다(databentoDownload.ts)
  return names.map((n) => join(dir, n)).filter((p) => statSync(p).size > 0);
}

async function eachRow(paths: readonly string[], onRow: (row: CsvRow) => void): Promise<void> {
  for (const path of paths) {
    const lines = createInterface({
      input: createReadStream(path).pipe(createZstdDecompress()),
      crlfDelay: Infinity,
    });
    let header: string[] | null = null;
    for await (const line of lines) {
      if (line === '') continue;
      const values = line.split(',');
      if (header === null) {
        header = values;
        continue;
      }
      const row: Record<string, string> = {};
      for (let i = 0; i < header.length; i++) row[header[i]] = values[i] ?? '';
      onRow(row);
    }
  }
}

type Loaded = {
  contracts: ContractInfo[];
  bars: (LoadedBar & { symbol: string })[];
  tradeDates: string[];
};

async function loadCommodity(data: string, code: CommodityCode): Promise<Loaded> {
  // 같은 instrument_id가 다른 월물로 다시 쓰이면 매핑이 틀어지므로 멈춘다
  const byId = new Map<string, ContractInfo>();
  await eachRow(await files(data, 'definition', code), (row) => {
    const info = parseDefinition(row);
    if (!info) return;
    const known = byId.get(info.instrumentId);
    if (known && known.symbol !== info.symbol) {
      throw new Error(`instrument ${info.instrumentId} is ${known.symbol} and ${info.symbol}`);
    }
    // 정의가 바뀌면(만기 조정 등) 마지막 값을 쓴다
    byId.set(info.instrumentId, info);
  });

  const stats = await files(data, 'statistics', code);
  const builder = createBarBuilder();
  await eachRow(stats, builder.addSettlement);
  await eachRow(stats, builder.addSessionStat);
  const { bars, stats: barStats } = builder.bars();

  const unknown = new Set<string>();
  const known: Loaded['bars'] = [];
  for (const bar of bars) {
    const info = byId.get(bar.instrumentId);
    if (info) known.push({ ...bar, symbol: info.symbol });
    else unknown.add(bar.instrumentId);
  }
  const used = new Set(known.map((b) => b.symbol));
  const contracts = [...byId.values()].filter((c) => used.has(c.symbol));
  const dates = builder.tradeDates();
  console.log(
    `[${code}] ${contracts.length} contracts, ${known.length} bars, ` +
      `${dates.length} trade days ${dates[0]}..${dates.at(-1)}`,
  );
  console.log(
    `[${code}] no volume ${barStats.noVolume}, no OHLC ${barStats.noOhlc}, ` +
      `invalid OHLC ${barStats.invalidOhlc}, unknown instruments ${unknown.size}`,
  );
  return { contracts, bars: known, tradeDates: dates };
}

async function save(code: CommodityCode, loaded: Loaded, now: Date): Promise<void> {
  const rules = await db
    .select({
      validFrom: activeMonthRule.validFrom,
      validTo: activeMonthRule.validTo,
      months: activeMonthRule.months,
    })
    .from(activeMonthRule)
    .where(eq(activeMonthRule.commodityCode, code));
  await db.transaction(async (tx) => {
    for (let i = 0; i < loaded.contracts.length; i += INSERT_CHUNK) {
      await tx
        .insert(contract)
        .values(
          loaded.contracts.slice(i, i + INSERT_CHUNK).map((c) => ({
            symbol: c.symbol,
            commodityCode: code,
            contractMonth: c.contractMonth,
            firstTradeDate: c.firstTradeDate,
            lastTradeDate: c.lastTradeDate,
            isTarget: isTargetMonth(c.contractMonth, rules),
          })),
        )
        .onConflictDoUpdate({
          target: contract.symbol,
          set: {
            firstTradeDate: sql`excluded.first_trade_date`,
            lastTradeDate: sql`excluded.last_trade_date`,
            isTarget: sql`excluded.is_target`,
          },
        });
    }
    for (let i = 0; i < loaded.bars.length; i += INSERT_CHUNK) {
      await tx
        .insert(dailyBar)
        .values(
          loaded.bars.slice(i, i + INSERT_CHUNK).map((b) => ({
            contractSymbol: b.symbol,
            tradeDate: b.tradeDate,
            open: b.open,
            high: b.high,
            low: b.low,
            settle: b.settle,
            volume: b.volume,
            source: 'DATABENTO' as const,
            collectedAt: now,
          })),
        )
        .onConflictDoUpdate({
          target: [dailyBar.contractSymbol, dailyBar.tradeDate],
          set: {
            open: sql`excluded.open`,
            high: sql`excluded.high`,
            low: sql`excluded.low`,
            settle: sql`excluded.settle`,
            volume: sql`excluded.volume`,
            source: sql`excluded.source`,
            collectedAt: sql`excluded.collected_at`,
          },
        });
    }
    const removed = await tx
      .delete(dailyBar)
      .where(
        and(
          eq(dailyBar.source, 'DATABENTO'),
          inArray(
            dailyBar.contractSymbol,
            tx
              .select({ symbol: contract.symbol })
              .from(contract)
              .where(eq(contract.commodityCode, code)),
          ),
          notInArray(dailyBar.tradeDate, loaded.tradeDates),
        ),
      )
      .returning({ tradeDate: dailyBar.tradeDate });
    if (removed.length > 0) {
      const days = [...new Set(removed.map((r) => r.tradeDate))].sort();
      console.log(`[${code}] removed ${removed.length} bars on ${days.join(', ')}`);
    }
  });
}

// 과거 trading_day(D-048): 어느 원자재든 정산가가 있는 날짜. 달력 입력(세션 시각 있음) 행은 두고,
// 달력 연도와 겹치는 구간은 차이만 알린다. 데이터에 없는 과거 행은 지운다
async function saveTradingDays(dates: ReadonlySet<string>, dryRun: boolean): Promise<void> {
  const sorted = [...dates].sort();
  const rows = await db
    .select({ tradeDate: tradingDay.tradeDate, sessionOpenAt: tradingDay.sessionOpenAt })
    .from(tradingDay);
  const calendar = rows
    .filter((r) => r.sessionOpenAt !== null)
    .map((r) => r.tradeDate)
    .sort();
  const stale = rows
    .filter((r) => r.sessionOpenAt === null && !dates.has(r.tradeDate))
    .map((r) => r.tradeDate)
    .sort();
  const last = sorted.at(-1) ?? '';
  const calendarInRange = new Set(calendar.filter((d) => d <= last));
  const onlyData = sorted.filter(
    (d) => calendar.length > 0 && d >= calendar[0] && !calendarInRange.has(d),
  );
  const onlyCalendar = [...calendarInRange].filter((d) => !dates.has(d));
  const weekend = sorted.filter((d) => [0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()));
  console.log(`[trading_day] ${sorted.length} days ${sorted[0]}..${last}`);
  if (weekend.length > 0) console.log(`[trading_day] weekend: ${weekend.join(', ')}`);
  if (onlyData.length > 0) console.log(`[trading_day] not in calendar: ${onlyData.join(', ')}`);
  if (onlyCalendar.length > 0)
    console.log(`[trading_day] calendar only: ${onlyCalendar.join(', ')}`);
  if (stale.length > 0) console.log(`[trading_day] not in data (removed): ${stale.join(', ')}`);
  if (dryRun) return;
  if (stale.length > 0) {
    await db
      .delete(tradingDay)
      .where(and(isNull(tradingDay.sessionOpenAt), inArray(tradingDay.tradeDate, stale)));
  }
  for (let i = 0; i < sorted.length; i += INSERT_CHUNK) {
    await db
      .insert(tradingDay)
      .values(sorted.slice(i, i + INSERT_CHUNK).map((tradeDate) => ({ tradeDate })))
      .onConflictDoNothing();
  }
}

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false }, data: { type: 'string' } },
  });
  const data = values.data ?? DEFAULT_DATA;
  const dryRun = values['dry-run'];
  const now = new Date();
  const dates = new Set<string>();
  for (const code of COMMODITY_CODES) {
    const started = Date.now();
    const loaded = await loadCommodity(data, code);
    for (const b of loaded.bars) dates.add(b.tradeDate);
    if (!dryRun) await save(code, loaded, now);
    console.log(`[${code}] ${dryRun ? 'checked' : 'saved'} in ${Date.now() - started} ms`);
  }
  await saveTradingDays(dates, dryRun);
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}

// 일일 정산 조회·저장(D-071)과 batch_run 기반 정산 상태. 흐름은 jobs/settle.ts
import { and, between, desc, eq, inArray, isNotNull, max, sql } from 'drizzle-orm';
import type { JobName } from '../constants.ts';
import type { SettleStore } from '../jobs/settle.ts';
import type { db as Db } from './client.ts';
import { tradingDaysBetween } from './queries.ts';
import { activeMonthRule, batchRun, contract, dailyBar, rollWeight } from './schema.ts';

async function lastSuccessTradeDate(db: typeof Db, job: JobName): Promise<string | null> {
  const [row] = await db
    .select({ tradeDate: max(batchRun.tradeDate) })
    .from(batchRun)
    .where(and(eq(batchRun.job, job), eq(batchRun.status, 'SUCCESS')));
  return row?.tradeDate ?? null;
}

// 그 작업의 마지막으로 끝난 실행이 실패인가
async function lastRunFailed(db: typeof Db, job: JobName): Promise<boolean> {
  const [row] = await db
    .select({ status: batchRun.status })
    .from(batchRun)
    .where(and(eq(batchRun.job, job), isNotNull(batchRun.finishedAt)))
    .orderBy(desc(batchRun.startedAt))
    .limit(1);
  return row?.status === 'FAILED';
}

// 일일 정산 ①이 성공한 가장 최근 거래일. 정산 대기 판정(marketState)의 입력이다(D-022, D-062)
export const lastSettledTradeDate = (db: typeof Db) => lastSuccessTradeDate(db, 'DAILY_SETTLE');

// 정정 확인 ②의 마지막으로 끝난 실행이 실패면 알림 판정을 멈춘다(product.md 배치 실패, D-071).
// ① 실패는 정산 대기라 장중 배치가 이미 돌지 않는다
export const isAlertJudgmentSuspended = (db: typeof Db) => lastRunFailed(db, 'SETTLE_REVISION');

export function createSettleStore(db: typeof Db): SettleStore {
  return {
    tradingDays: (from, to) => tradingDaysBetween(db, from, to),
    lastSuccessTradeDate: (job) => lastSuccessTradeDate(db, job),
    lastRunFailed: (job) => lastRunFailed(db, job),
    async lastDailyBarDate() {
      const [row] = await db.select({ tradeDate: max(dailyBar.tradeDate) }).from(dailyBar);
      return row?.tradeDate ?? null;
    },
    activeMonthRules: (code) =>
      db
        .select({
          validFrom: activeMonthRule.validFrom,
          validTo: activeMonthRule.validTo,
          months: activeMonthRule.months,
        })
        .from(activeMonthRule)
        .where(eq(activeMonthRule.commodityCode, code)),
    contracts: (code) =>
      db
        .select({
          symbol: contract.symbol,
          firstTradeDate: contract.firstTradeDate,
          lastTradeDate: contract.lastTradeDate,
          isTarget: contract.isTarget,
        })
        .from(contract)
        .where(eq(contract.commodityCode, code)),
    async insertContracts(rows) {
      if (rows.length === 0) return;
      await db
        .insert(contract)
        .values([...rows])
        .onConflictDoNothing();
    },
    dailyBars: (code, tradeDate) =>
      db
        .select({
          contractSymbol: dailyBar.contractSymbol,
          open: dailyBar.open,
          high: dailyBar.high,
          low: dailyBar.low,
          settle: dailyBar.settle,
          volume: dailyBar.volume,
          source: dailyBar.source,
          revisedAt: dailyBar.revisedAt,
        })
        .from(dailyBar)
        .where(
          and(
            eq(dailyBar.tradeDate, tradeDate),
            inArray(
              dailyBar.contractSymbol,
              db
                .select({ symbol: contract.symbol })
                .from(contract)
                .where(eq(contract.commodityCode, code)),
            ),
          ),
        ),
    sourceBarDates: (code, source, from, to) =>
      db
        .select({ contractSymbol: dailyBar.contractSymbol, tradeDate: dailyBar.tradeDate })
        .from(dailyBar)
        .innerJoin(contract, eq(contract.symbol, dailyBar.contractSymbol))
        .where(
          and(
            eq(contract.commodityCode, code),
            eq(dailyBar.source, source),
            between(dailyBar.tradeDate, from, to),
          ),
        ),
    async indexSymbols(code, tradeDate) {
      const rows = await db
        .selectDistinct({ contractSymbol: rollWeight.contractSymbol })
        .from(rollWeight)
        .where(and(eq(rollWeight.commodityCode, code), eq(rollWeight.tradeDate, tradeDate)));
      return rows.map((r) => r.contractSymbol);
    },
    async upsertDailyBars(rows) {
      if (rows.length === 0) return;
      const excluded = (column: string) => sql.raw(`excluded.${column}`);
      await db
        .insert(dailyBar)
        .values([...rows])
        .onConflictDoUpdate({
          target: [dailyBar.contractSymbol, dailyBar.tradeDate],
          set: {
            open: excluded('open'),
            high: excluded('high'),
            low: excluded('low'),
            settle: excluded('settle'),
            volume: excluded('volume'),
            source: excluded('source'),
            collectedAt: excluded('collected_at'),
            // 다시 받아도(① 재수집) 이전 정정 기록은 남긴다
            revisedAt: sql`coalesce(excluded.revised_at, ${dailyBar.revisedAt})`,
          },
        });
    },
  };
}

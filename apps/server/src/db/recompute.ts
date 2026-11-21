// 재계산 파이프라인의 조회·저장(D-070). 계산은 calc/recompute.ts, 흐름은 jobs/recompute.ts
import { and, asc, eq, sql } from 'drizzle-orm';
import type { Basis, CommodityCode } from '@futureetp/shared';
import type { RecomputeInput, RecomputeResult } from '../calc/recompute.ts';
import type { db as Db } from './client.ts';
import {
  contract,
  dailyBar,
  disparity,
  disparityDistribution,
  indexBar,
  indexScale,
  rollRule,
  rollWeight,
  tradingDay,
} from './schema.ts';

type Tx = Parameters<Parameters<typeof Db.transaction>[0]>[0];

export type CommoditySource = Omit<RecomputeInput, 'rule'> & {
  // roll_rule.params 원본. 사람이 고친 행(D-024)일 수 있어 기준값별로 검사한다(jobs/recompute.ts)
  rules: Partial<Record<'KR' | 'US', unknown>>;
};

export async function loadCommoditySource(
  db: typeof Db,
  commodityCode: CommodityCode,
): Promise<CommoditySource> {
  const [contracts, bars, days, rules] = await Promise.all([
    db
      .select({
        symbol: contract.symbol,
        contractMonth: contract.contractMonth,
        lastTradeDate: contract.lastTradeDate,
        isTarget: contract.isTarget,
      })
      .from(contract)
      .where(eq(contract.commodityCode, commodityCode)),
    db
      .select({
        contractSymbol: dailyBar.contractSymbol,
        tradeDate: dailyBar.tradeDate,
        open: dailyBar.open,
        high: dailyBar.high,
        low: dailyBar.low,
        settle: dailyBar.settle,
        volume: dailyBar.volume,
      })
      .from(dailyBar)
      .innerJoin(contract, eq(contract.symbol, dailyBar.contractSymbol))
      .where(eq(contract.commodityCode, commodityCode)),
    db
      .select({ tradeDate: tradingDay.tradeDate })
      .from(tradingDay)
      .orderBy(asc(tradingDay.tradeDate)),
    db
      .select({ basis: rollRule.basis, params: rollRule.params })
      .from(rollRule)
      .where(eq(rollRule.commodityCode, commodityCode)),
  ]);
  return {
    commodityCode,
    contracts,
    bars,
    tradeDates: days.map((d) => d.tradeDate),
    rules: Object.fromEntries(rules.map((r) => [r.basis, r.params])),
  };
}

// 한 번에 넣는 행 수(Postgres 매개변수 65,535개 제한 안쪽)
const CHUNK = 5000;

async function insertChunked<T>(rows: readonly T[], insert: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

// 원자재·기준값의 계산 결과를 통째로 바꾼다. result가 null이면 지우기만 한다(규칙 없는 기준값).
// CLI 재계산과 배치가 같은 원자재·기준값을 동시에 바꾸면 둘 다 빈 상태에 INSERT해 23505가 나므로,
// 트랜잭션 잠금으로 줄을 세운다. 뒤에 온 쪽은 앞쪽이 커밋한 뒤 DELETE부터 다시 보므로 마지막 결과가 남는다.
// 잠금은 커밋·롤백 때 저절로 풀린다. 해시가 겹치면 다른 키끼리 잠깐 기다릴 뿐 결과는 같다
export async function replaceBasisResult(
  db: typeof Db,
  commodityCode: CommodityCode,
  basis: Basis,
  result: RecomputeResult | null,
  now: Date,
): Promise<void> {
  await db.transaction(async (tx: Tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`recompute:${commodityCode}:${basis}`}))`,
    );
    for (const table of [
      rollWeight,
      indexBar,
      indexScale,
      disparity,
      disparityDistribution,
    ] as const) {
      await tx
        .delete(table)
        .where(and(eq(table.commodityCode, commodityCode), eq(table.basis, basis)));
    }
    if (result === null) return;

    const key = { commodityCode, basis };
    await insertChunked(result.rollWeights, (rows) =>
      tx.insert(rollWeight).values(rows.map((r) => ({ ...key, ...r }))),
    );
    await insertChunked(result.indexBars, (rows) =>
      tx.insert(indexBar).values(rows.map((r) => ({ ...key, ...r }))),
    );
    if (result.scaleRatio !== null) {
      await tx.insert(indexScale).values({ ...key, ratio: result.scaleRatio, updatedAt: now });
    }
    const disparityRows = result.disparities.flatMap(({ maPeriod, rows }) =>
      rows.map((r) => ({ ...key, maPeriod, ...r })),
    );
    await insertChunked(disparityRows, (rows) => tx.insert(disparity).values(rows));
    if (result.distributions.length > 0) {
      await tx
        .insert(disparityDistribution)
        .values(result.distributions.map((d) => ({ ...key, ...d })));
    }
  });
}

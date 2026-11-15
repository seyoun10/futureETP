import { and, eq } from 'drizzle-orm';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '../db/client.ts';
import { contract, dailyBar, indexBar, rollRule, tradingDay } from '../db/schema.ts';
import { resetDb } from '../db/testDb.ts';
import { recomputeCommodity } from './recompute.ts';

const NOW = new Date('2026-10-28T23:30:00Z');
const DATES = ['2026-10-26', '2026-10-27', '2026-10-28'];

// roll_rule은 시드 테이블이라 resetDb가 되돌리지 않는다. 테스트가 바꾼 GC 규칙은 원래 행으로 돌려 놓는다
let gcRules: (typeof rollRule.$inferSelect)[] = [];

const gcClosesOf = async (basis: 'FRONT' | 'KR' | 'US') =>
  (
    await db
      .select({ close: indexBar.close })
      .from(indexBar)
      .where(and(eq(indexBar.commodityCode, 'GC'), eq(indexBar.basis, basis)))
  ).length;

beforeEach(async () => {
  await resetDb(db);
  gcRules = await db.select().from(rollRule).where(eq(rollRule.commodityCode, 'GC'));
  await db.insert(contract).values({
    symbol: 'GCZ26',
    commodityCode: 'GC',
    contractMonth: '2026-12',
    lastTradeDate: '2026-12-29',
    isTarget: true,
  });
  await db
    .insert(tradingDay)
    .values(DATES.map((tradeDate) => ({ tradeDate, sessionOpenAt: NOW, sessionCloseAt: NOW })));
  await db.insert(dailyBar).values(
    DATES.map((tradeDate, i) => ({
      contractSymbol: 'GCZ26',
      tradeDate,
      settle: 2000 + i,
      volume: 100,
      source: 'MASSIVE' as const,
      collectedAt: NOW,
    })),
  );
});

afterEach(async () => {
  await db.delete(rollRule).where(eq(rollRule.commodityCode, 'GC'));
  await db.insert(rollRule).values(gcRules);
});

afterAll(() => db.$client.end());

describe('recomputeCommodity', () => {
  it('규칙이 없는 기준값은 지우기만 하고 대표월물은 일봉 수만큼 저장한다', async () => {
    await db.delete(rollRule).where(eq(rollRule.commodityCode, 'GC'));

    const summaries = await recomputeCommodity(db, 'GC', NOW);

    expect(summaries).toEqual([
      { basis: 'FRONT', days: 3, lastTradeDate: '2026-10-28' },
      { basis: 'KR', days: null, lastTradeDate: null },
      { basis: 'US', days: null, lastTradeDate: null },
    ]);
    expect(await gcClosesOf('FRONT')).toBe(3);
    expect(await gcClosesOf('KR')).toBe(0);
  });

  it('한 기준값의 규칙 행이 잘못돼도 나머지는 저장하고 실패를 모아 던진다', async () => {
    await db
      .update(rollRule)
      .set({ params: { broken: true } })
      .where(and(eq(rollRule.commodityCode, 'GC'), eq(rollRule.basis, 'KR')));
    await db
      .delete(rollRule)
      .where(and(eq(rollRule.commodityCode, 'GC'), eq(rollRule.basis, 'US')));

    await expect(recomputeCommodity(db, 'GC', NOW)).rejects.toThrow(/^Recompute failed: GC KR: /);
    expect(await gcClosesOf('FRONT')).toBe(3);
    expect(await gcClosesOf('KR')).toBe(0);
  });
});

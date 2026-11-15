import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './client.ts';
import { createCommoditiesStore } from './commoditiesStore.ts';
import { contract, dailyBar, rollWeight } from './schema.ts';
import { resetDb } from './testDb.ts';

const store = createCommoditiesStore(db);
const AT = new Date('2026-10-27T22:00:00Z');

const bar = (contractSymbol: string, tradeDate: string, settle: number) => ({
  contractSymbol,
  tradeDate,
  settle,
  volume: 1,
  source: 'MASSIVE' as const,
  collectedAt: AT,
});

beforeEach(async () => {
  await resetDb(db);
  await db.insert(contract).values(
    (
      [
        ['CLZ26', 'CL'],
        ['CLF27', 'CL'],
        ['GCZ26', 'GC'],
      ] as const
    ).map(([symbol, commodityCode]) => ({
      symbol,
      commodityCode: commodityCode,
      contractMonth: '2026-12',
      lastTradeDate: '2026-12-29',
      isTarget: true,
    })),
  );
});
afterAll(() => db.$client.end());

describe('frontSymbols', () => {
  it('원자재마다 그날까지의 마지막 FRONT 행 월물이고, 행이 없는 원자재는 빠진다', async () => {
    await db.insert(rollWeight).values([
      {
        commodityCode: 'CL',
        basis: 'FRONT',
        tradeDate: '2026-10-26',
        contractSymbol: 'CLZ26',
        weight: 1,
      },
      {
        commodityCode: 'CL',
        basis: 'FRONT',
        tradeDate: '2026-10-27',
        contractSymbol: 'CLF27',
        weight: 1,
      },
      {
        commodityCode: 'CL',
        basis: 'FRONT',
        tradeDate: '2026-10-28',
        contractSymbol: 'CLZ26',
        weight: 1,
      },
      {
        commodityCode: 'CL',
        basis: 'KR',
        tradeDate: '2026-10-27',
        contractSymbol: 'CLZ26',
        weight: 1,
      },
      {
        commodityCode: 'GC',
        basis: 'FRONT',
        tradeDate: '2026-10-20',
        contractSymbol: 'GCZ26',
        weight: 1,
      },
    ]);
    expect(await store.frontSymbols('2026-10-27')).toEqual(
      expect.arrayContaining([
        { commodityCode: 'CL', contractSymbol: 'CLF27' },
        { commodityCode: 'GC', contractSymbol: 'GCZ26' },
      ]),
    );
    expect(await store.frontSymbols('2026-10-27')).toHaveLength(2);
  });
});

describe('lastBarsBefore', () => {
  it('월물마다 그날 전 마지막 봉 하나이고, 요청하지 않았거나 봉이 없는 월물은 빠진다', async () => {
    await db
      .insert(dailyBar)
      .values([
        bar('CLZ26', '2026-10-23', 60),
        bar('CLZ26', '2026-10-26', 61),
        bar('CLZ26', '2026-10-27', 62),
        bar('GCZ26', '2026-10-23', 2000),
      ]);
    const rows = await store.lastBarsBefore(['CLZ26', 'CLF27'], '2026-10-27');
    expect(rows).toEqual([
      {
        contractSymbol: 'CLZ26',
        tradeDate: '2026-10-26',
        settle: 61,
        collectedAt: AT,
        revisedAt: null,
      },
    ]);
  });
});

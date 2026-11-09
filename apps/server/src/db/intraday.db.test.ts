import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DisparityByMa } from '../calc/intraday.ts';
import { db } from './client.ts';
import { createIntradayStore } from './intraday.ts';
import { contract, indexBar, indexSnapshot, intradaySnapshot, rollWeight } from './schema.ts';
import { resetDb } from './testDb.ts';

const store = createIntradayStore(db);
const CAPTURED = new Date('2026-10-27T15:00:00Z');

const quote = (last: number, contractSymbol = 'GCZ26') => ({
  contractSymbol,
  capturedAt: CAPTURED,
  tradeDate: '2026-10-27',
  last,
  dayOpen: 100,
  dayHigh: 110,
  dayLow: 90,
  volume: 1000,
  sourceTime: CAPTURED,
});

const index = (last: number) => ({
  commodityCode: 'GC' as const,
  basis: 'FRONT' as const,
  capturedAt: CAPTURED,
  tradeDate: '2026-10-27',
  open: 100,
  high: 110,
  low: 90,
  last,
  disparityByMa: { 20: 1.5 } as unknown as DisparityByMa,
});

beforeEach(async () => {
  await resetDb(db);
  await db.insert(contract).values(
    ['GCV26', 'GCZ26'].map((symbol) => ({
      symbol,
      commodityCode: 'GC' as const,
      contractMonth: '2026-12',
      lastTradeDate: '2026-12-29',
      isTarget: true,
    })),
  );
});
afterAll(() => db.$client.end());

describe('save', () => {
  it('같은 시각을 다시 저장하면 값을 바꾼다', async () => {
    await store.save([quote(105)], [index(105)]);
    await store.save([quote(106)], [index(106)]);

    expect(await db.select({ last: intradaySnapshot.last }).from(intradaySnapshot)).toEqual([
      { last: 106 },
    ]);
    expect(await db.select({ last: indexSnapshot.last }).from(indexSnapshot)).toEqual([
      { last: 106 },
    ]);
  });

  it('jsonb 이격도를 객체로 돌려준다', async () => {
    await store.save([], [index(105)]);
    const [row] = await db.select().from(indexSnapshot);
    expect(row?.disparityByMa).toEqual({ 20: 1.5 });
  });

  it('지수 저장이 실패하면 시세도 남기지 않는다', async () => {
    await expect(
      store.save([quote(105)], [{ ...index(105), commodityCode: 'NOPE' as unknown as 'GC' }]),
    ).rejects.toThrow();

    expect(await db.select().from(intradaySnapshot)).toEqual([]);
  });
});

describe('heldWeights', () => {
  const weight = (tradeDate: string, contractSymbol: string, basis: 'FRONT' | 'KR' = 'FRONT') => ({
    commodityCode: 'GC' as const,
    basis,
    tradeDate,
    contractSymbol,
    weight: 0.5,
  });

  it('기준값마다 기준일 전 가장 최근 거래일의 비중만 읽는다', async () => {
    await db
      .insert(rollWeight)
      .values([
        weight('2026-10-23', 'GCV26'),
        weight('2026-10-26', 'GCV26'),
        weight('2026-10-26', 'GCZ26'),
        weight('2026-10-27', 'GCZ26'),
        weight('2026-10-22', 'GCZ26', 'KR'),
      ]);

    const rows = await store.heldWeights('GC', '2026-10-27');

    expect(rows.map((r) => [r.basis, r.tradeDate, r.contractSymbol]).sort()).toEqual([
      ['FRONT', '2026-10-26', 'GCV26'],
      ['FRONT', '2026-10-26', 'GCZ26'],
      ['KR', '2026-10-22', 'GCZ26'],
    ]);
  });

  it('비중이 없으면 빈 목록이다', async () => {
    expect(await store.heldWeights('GC', '2026-10-27')).toEqual([]);
  });
});

describe('indexHistory', () => {
  it('기준일 전 최근 N일을 오래된 순으로 읽는다', async () => {
    const bar = (tradeDate: string, close: number) => ({
      commodityCode: 'GC' as const,
      basis: 'FRONT' as const,
      tradeDate,
      close,
      blendedPrice: close,
      isValid: true,
      inRollPeriod: false,
    });
    await db
      .insert(indexBar)
      .values([
        bar('2026-10-22', 1),
        bar('2026-10-23', 2),
        bar('2026-10-26', 3),
        bar('2026-10-27', 4),
      ]);

    const rows = await store.indexHistory('GC', 'FRONT', '2026-10-27', 2);

    expect(rows.map((r) => r.close)).toEqual([2, 3]);
  });
});

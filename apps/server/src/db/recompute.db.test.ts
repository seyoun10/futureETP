import { and, eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { RecomputeResult } from '../calc/recompute.ts';
import { db } from './client.ts';
import { loadCommoditySource, replaceBasisResult } from './recompute.ts';
import {
  contract,
  dailyBar,
  disparity,
  disparityDistribution,
  indexBar,
  indexScale,
  rollWeight,
  tradingDay,
} from './schema.ts';
import { resetDb } from './testDb.ts';

const NOW = new Date('2026-10-27T23:30:00Z');
const TRADE_DATE = '2026-10-27';

const indexBarRow = (tradeDate: string, close: number) => ({
  tradeDate,
  open: close,
  high: close,
  low: close,
  close,
  blendedPrice: close,
  isValid: true,
  inRollPeriod: false,
});

const result = (close: number, symbol = 'GCZ26'): RecomputeResult => ({
  rollWeights: [{ tradeDate: TRADE_DATE, contractSymbol: symbol, weight: 1 }],
  indexBars: [indexBarRow(TRADE_DATE, close)],
  scaleRatio: 1.5,
  disparities: [{ maPeriod: 20, rows: [{ tradeDate: TRADE_DATE, ma: close, disparity: 0.5 }] }],
  distributions: [
    {
      maPeriod: 20,
      window: 'ALL',
      asOfTradeDate: TRADE_DATE,
      actualStartDate: TRADE_DATE,
      sampleCount: 1,
      sortedValues: [0.5],
    },
  ],
});

const closes = async (basis: 'FRONT' | 'KR') =>
  (
    await db
      .select({ close: indexBar.close })
      .from(indexBar)
      .where(and(eq(indexBar.commodityCode, 'GC'), eq(indexBar.basis, basis)))
  ).map((r) => r.close);

beforeEach(async () => {
  await resetDb(db);
  await db.insert(contract).values({
    symbol: 'GCZ26',
    commodityCode: 'GC',
    contractMonth: '2026-12',
    lastTradeDate: '2026-12-29',
    isTarget: true,
  });
});
afterAll(() => db.$client.end());

describe('replaceBasisResult', () => {
  it('결과의 다섯 테이블을 모두 저장한다', async () => {
    await replaceBasisResult(db, 'GC', 'FRONT', result(100), NOW);

    expect(await db.select().from(rollWeight)).toHaveLength(1);
    expect(await closes('FRONT')).toEqual([100]);
    expect(await db.select({ ratio: indexScale.ratio }).from(indexScale)).toEqual([{ ratio: 1.5 }]);
    expect(await db.select().from(disparity)).toHaveLength(1);
    expect(
      await db
        .select({ sortedValues: disparityDistribution.sortedValues })
        .from(disparityDistribution),
    ).toEqual([{ sortedValues: [0.5] }]);
  });

  it('다시 저장하면 이전 결과를 통째로 바꾼다', async () => {
    await replaceBasisResult(
      db,
      'GC',
      'FRONT',
      { ...result(100), indexBars: [indexBarRow('2026-10-26', 90), indexBarRow(TRADE_DATE, 100)] },
      NOW,
    );
    await replaceBasisResult(db, 'GC', 'FRONT', result(200), NOW);

    expect(await closes('FRONT')).toEqual([200]);
  });

  it('다른 기준값은 건드리지 않는다', async () => {
    await replaceBasisResult(db, 'GC', 'KR', result(50), NOW);
    await replaceBasisResult(db, 'GC', 'FRONT', result(100), NOW);
    await replaceBasisResult(db, 'GC', 'FRONT', null, NOW);

    expect(await closes('FRONT')).toEqual([]);
    expect(await closes('KR')).toEqual([50]);
  });

  it('저장 도중 실패하면 이전 결과를 그대로 남긴다', async () => {
    await replaceBasisResult(db, 'GC', 'FRONT', result(100), NOW);

    // index_bar를 지운 뒤 없는 월물의 roll_weight에서 외래 키로 실패한다
    await expect(replaceBasisResult(db, 'GC', 'FRONT', result(200, 'NOPE'), NOW)).rejects.toThrow();

    expect(await closes('FRONT')).toEqual([100]);
    expect(await db.select().from(rollWeight)).toHaveLength(1);
  });

  it('scaleRatio가 null이면 index_scale 행을 두지 않는다', async () => {
    await replaceBasisResult(db, 'GC', 'FRONT', result(100), NOW);
    await replaceBasisResult(db, 'GC', 'FRONT', { ...result(100), scaleRatio: null }, NOW);

    expect(await db.select().from(indexScale)).toEqual([]);
  });

  it('Postgres 매개변수 한도를 넘는 행 수도 나눠서 저장한다', async () => {
    const start = Date.UTC(1990, 0, 1);
    const indexBars = Array.from({ length: 12_000 }, (_, i) =>
      indexBarRow(new Date(start + i * 86_400_000).toISOString().slice(0, 10), 100),
    );
    await replaceBasisResult(db, 'GC', 'FRONT', { ...result(100), indexBars }, NOW);

    expect(await closes('FRONT')).toHaveLength(12_000);
  });
});

describe('loadCommoditySource', () => {
  it('그 원자재의 월물·봉과 전체 거래일을 시드 규칙과 함께 읽는다', async () => {
    await db.insert(contract).values({
      symbol: 'CLZ26',
      commodityCode: 'CL',
      contractMonth: '2026-12',
      lastTradeDate: '2026-11-20',
      isTarget: true,
    });
    const bar = {
      tradeDate: TRADE_DATE,
      settle: 100,
      volume: 1,
      source: 'MASSIVE',
      collectedAt: NOW,
    } as const;
    await db.insert(dailyBar).values([
      { ...bar, contractSymbol: 'GCZ26' },
      { ...bar, contractSymbol: 'CLZ26' },
    ]);
    const day = {
      sessionOpenAt: NOW,
      sessionCloseAt: NOW,
    };
    await db.insert(tradingDay).values([
      { ...day, tradeDate: '2026-10-27' },
      { ...day, tradeDate: '2026-10-26' },
    ]);

    const source = await loadCommoditySource(db, 'GC');

    expect(source.contracts.map((c) => c.symbol)).toEqual(['GCZ26']);
    expect(source.bars.map((b) => b.contractSymbol)).toEqual(['GCZ26']);
    expect(source.tradeDates).toEqual(['2026-10-26', '2026-10-27']);
    expect(Object.keys(source.rules).sort()).toEqual(['KR', 'US']);
  });
});

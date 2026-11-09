import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type { DailyBarRow, NewContract } from '../jobs/settle.ts';
import { db } from './client.ts';
import { batchRun } from './schema.ts';
import { createSettleStore, isAlertJudgmentSuspended, lastSettledTradeDate } from './settle.ts';
import { resetDb } from './testDb.ts';

const store = createSettleStore(db);
const COLLECTED = new Date('2026-10-27T23:30:00Z');
const REVISED = new Date('2026-10-28T12:00:00Z');

const contractRow = (over: Partial<NewContract> = {}): NewContract => ({
  symbol: 'GCZ26',
  commodityCode: 'GC',
  contractMonth: '2026-12',
  firstTradeDate: '2024-12-01',
  lastTradeDate: '2026-12-29',
  isTarget: true,
  ...over,
});

const barRow = (over: Partial<DailyBarRow> = {}): DailyBarRow => ({
  contractSymbol: 'GCZ26',
  tradeDate: '2026-10-27',
  open: 100,
  high: 110,
  low: 90,
  settle: 105.5,
  volume: 1000,
  source: 'MASSIVE',
  collectedAt: COLLECTED,
  revisedAt: null,
  ...over,
});

beforeEach(() => resetDb(db));
afterAll(() => db.$client.end());

describe('insertContracts', () => {
  it('이미 있는 심볼은 덮어쓰지 않는다', async () => {
    await store.insertContracts([contractRow()]);
    await store.insertContracts([contractRow({ lastTradeDate: '2030-01-01', isTarget: false })]);

    expect(await store.contracts('GC')).toEqual([
      {
        symbol: 'GCZ26',
        firstTradeDate: '2024-12-01',
        lastTradeDate: '2026-12-29',
        isTarget: true,
      },
    ]);
  });

  it('빈 목록은 아무것도 하지 않는다', async () => {
    await store.insertContracts([]);
    expect(await store.contracts('GC')).toEqual([]);
  });
});

describe('upsertDailyBars', () => {
  beforeEach(() => store.insertContracts([contractRow()]));

  it('같은 월물·거래일을 다시 저장하면 값을 바꾼다', async () => {
    await store.upsertDailyBars([barRow()]);
    await store.upsertDailyBars([barRow({ settle: 106.25, volume: 2000, source: 'DATABENTO' })]);

    expect(await store.dailyBars('GC', '2026-10-27')).toEqual([
      expect.objectContaining({ settle: 106.25, volume: 2000, source: 'DATABENTO' }),
    ]);
  });

  it('재수집이 revisedAt 없이 저장해도 이전 정정 기록을 남긴다', async () => {
    await store.upsertDailyBars([barRow({ revisedAt: REVISED })]);
    await store.upsertDailyBars([barRow({ revisedAt: null })]);

    const [bar] = await store.dailyBars('GC', '2026-10-27');
    expect(bar?.revisedAt).toEqual(REVISED);
  });

  it('새 정정은 revisedAt을 바꾼다', async () => {
    const later = new Date('2026-10-30T12:00:00Z');
    await store.upsertDailyBars([barRow({ revisedAt: REVISED })]);
    await store.upsertDailyBars([barRow({ revisedAt: later })]);

    const [bar] = await store.dailyBars('GC', '2026-10-27');
    expect(bar?.revisedAt).toEqual(later);
  });

  it('없는 월물의 봉은 외래 키로 거절한다', async () => {
    await expect(store.upsertDailyBars([barRow({ contractSymbol: 'NOPE' })])).rejects.toThrow();
  });
});

describe('봉 조회', () => {
  beforeEach(async () => {
    await store.insertContracts([
      contractRow(),
      contractRow({ symbol: 'CLZ26', commodityCode: 'CL' }),
    ]);
    await store.upsertDailyBars([
      barRow(),
      barRow({ tradeDate: '2026-10-26', source: 'DATABENTO' }),
      barRow({ tradeDate: '2026-10-20' }),
      barRow({ contractSymbol: 'CLZ26' }),
    ]);
  });

  it('dailyBars는 그 원자재의 월물만 읽는다', async () => {
    expect(await store.dailyBars('CL', '2026-10-27')).toEqual([
      expect.objectContaining({ contractSymbol: 'CLZ26' }),
    ]);
  });

  it('sourceBarDates는 원자재·소스·기간을 모두 거른다', async () => {
    expect(await store.sourceBarDates('GC', 'MASSIVE', '2026-10-21', '2026-10-27')).toEqual([
      { contractSymbol: 'GCZ26', tradeDate: '2026-10-27' },
    ]);
  });

  it('lastDailyBarDate는 가장 최근 거래일이다', async () => {
    expect(await store.lastDailyBarDate()).toBe('2026-10-27');
  });
});

describe('recomputePending', () => {
  it('원자재별로 켜고 끈다', async () => {
    await store.setRecomputePending('GC', COLLECTED);
    expect(await store.recomputePending('GC')).toBe(true);
    expect(await store.recomputePending('SI')).toBe(false);

    await store.setRecomputePending('GC', null);
    expect(await store.recomputePending('GC')).toBe(false);
  });
});

describe('batch_run 기반 상태', () => {
  const run = (
    job: 'DAILY_SETTLE' | 'SETTLE_REVISION',
    status: 'RUNNING' | 'SUCCESS' | 'FAILED',
    startedAt: string,
    tradeDate = '2026-10-27',
  ) =>
    db.insert(batchRun).values({
      job,
      status,
      tradeDate,
      startedAt: new Date(startedAt),
      finishedAt: status === 'RUNNING' ? null : new Date(startedAt),
    });

  it('마지막 성공 거래일은 실패와 다른 작업을 세지 않는다', async () => {
    await run('DAILY_SETTLE', 'SUCCESS', '2026-10-26T23:00:00Z', '2026-10-26');
    await run('DAILY_SETTLE', 'FAILED', '2026-10-27T23:00:00Z', '2026-10-27');
    await run('SETTLE_REVISION', 'SUCCESS', '2026-10-28T12:00:00Z', '2026-10-28');

    expect(await lastSettledTradeDate(db)).toBe('2026-10-26');
  });

  it('성공 기록이 없으면 null이다', async () => {
    expect(await lastSettledTradeDate(db)).toBeNull();
  });

  it('정정 확인의 마지막 실행이 실패면 알림 판정을 멈춘다', async () => {
    await run('SETTLE_REVISION', 'SUCCESS', '2026-10-27T12:00:00Z');
    await run('SETTLE_REVISION', 'FAILED', '2026-10-28T12:00:00Z');
    expect(await isAlertJudgmentSuspended(db)).toBe(true);
  });

  it('실패 뒤 성공하면 알림 판정을 재개한다', async () => {
    await run('SETTLE_REVISION', 'FAILED', '2026-10-27T12:00:00Z');
    await run('SETTLE_REVISION', 'SUCCESS', '2026-10-28T12:00:00Z');
    expect(await isAlertJudgmentSuspended(db)).toBe(false);
  });

  it('아직 도는 실행은 판정에 넣지 않는다', async () => {
    await run('SETTLE_REVISION', 'FAILED', '2026-10-27T12:00:00Z');
    await run('SETTLE_REVISION', 'RUNNING', '2026-10-28T12:00:00Z');
    expect(await isAlertJudgmentSuspended(db)).toBe(true);
  });
});

import { describe, expect, it, vi } from 'vitest';
import { runJob, type BatchRunStore, type FinishedStatus } from './runner.ts';

type Row = {
  id: string;
  job: string;
  attempt: number;
  scheduledAt: Date | null;
  startedAt: Date;
  status: 'RUNNING' | FinishedStatus;
  tradeDate?: string | null;
  error?: string | null;
};

function memoryStore() {
  const rows: Row[] = [];
  const store: BatchRunStore = {
    start(run) {
      const id = `run-${rows.length + 1}`;
      rows.push({ id, ...run, status: 'RUNNING' });
      return Promise.resolve(id);
    },
    finish(id, result) {
      Object.assign(
        rows.find((r) => r.id === id)!,
        result,
      );
      return Promise.resolve();
    },
    failInterrupted: () => Promise.resolve(0),
  };
  return { rows, store };
}

const T0 = new Date('2026-10-27T23:30:00Z');

describe('runJob', () => {
  it('성공하면 행 하나를 SUCCESS로 닫고 tradeDate를 남긴다', async () => {
    const { rows, store } = memoryStore();
    const result = await runJob(
      'DAILY_SETTLE',
      (ctx) => {
        ctx.tradeDate = '2026-10-27';
        return Promise.resolve();
      },
      { store, maxAttempts: 2, retryDelayMs: 1000, scheduledAt: T0, now: () => T0 },
    );

    expect(result).toEqual({ status: 'SUCCESS', runId: 'run-1', attempt: 1 });
    expect(rows).toEqual([
      expect.objectContaining({
        job: 'DAILY_SETTLE',
        attempt: 1,
        scheduledAt: T0,
        status: 'SUCCESS',
        tradeDate: '2026-10-27',
        error: null,
      }),
    ]);
  });

  it('실패하면 기다린 뒤 1회 재시도하고 시도마다 행을 만든다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rows, store } = memoryStore();
    const sleep = vi.fn(async () => {});
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error('no data yet'))
      .mockResolvedValueOnce(undefined);

    const result = await runJob('DAILY_SETTLE', handler, {
      store,
      maxAttempts: 2,
      retryDelayMs: 900_000,
      sleep,
    });

    expect(result).toMatchObject({ status: 'SUCCESS', attempt: 2 });
    expect(sleep).toHaveBeenCalledWith(900_000);
    expect(rows.map((r) => [r.attempt, r.status, r.error])).toEqual([
      [1, 'FAILED', 'no data yet'],
      [2, 'SUCCESS', null],
    ]);
  });

  it('재시도까지 실패하면 마지막 행이 최종 FAILED다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rows, store } = memoryStore();
    const result = await runJob('INTRADAY', () => Promise.reject(new Error('schema mismatch')), {
      store,
      maxAttempts: 2,
      retryDelayMs: 0,
      sleep: async () => {},
    });

    expect(result).toEqual({ status: 'FAILED', runId: 'run-2', attempt: 2 });
    expect(rows.map((r) => r.status)).toEqual(['FAILED', 'FAILED']);
  });

  it('maxAttempts 1이면 재시도하지 않는다(CLI)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rows, store } = memoryStore();
    const sleep = vi.fn(async () => {});
    const result = await runJob('ETP', () => Promise.reject(new Error('down')), {
      store,
      maxAttempts: 1,
      retryDelayMs: 0,
      sleep,
    });

    expect(result.status).toBe('FAILED');
    expect(rows).toHaveLength(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('기준 시각을 주면 작업의 now가 그 값이고 실행 시각은 실제 시각이다', async () => {
    const { rows, store } = memoryStore();
    const asOf = new Date('2026-03-09T18:30:00-05:00');
    let seen: Date | undefined;
    await runJob(
      'DAILY_SETTLE',
      (ctx) => {
        seen = ctx.now;
        return Promise.resolve();
      },
      { store, maxAttempts: 1, retryDelayMs: 0, asOf, now: () => T0 },
    );

    expect(seen).toEqual(asOf);
    expect(rows[0]).toMatchObject({ startedAt: T0, scheduledAt: null });
  });
});

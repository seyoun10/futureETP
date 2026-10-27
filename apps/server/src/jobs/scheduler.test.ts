import { Cron } from 'croner';
import { describe, expect, it, vi } from 'vitest';
import { JOB_NAMES } from '../constants.ts';
import type { BatchRunStore } from './runner.ts';
import { createTriggerRunner, TRIGGERS } from './scheduler.ts';

const nextRun = (cron: string, timezone: string, from: string) =>
  new Cron(cron, { timezone, paused: true }).nextRun(new Date(from))?.toISOString();

function countingStore(): BatchRunStore {
  let n = 0;
  return {
    start: () => Promise.resolve(`run-${++n}`),
    finish: async () => {},
    failInterrupted: () => Promise.resolve(0),
  };
}

describe('TRIGGERS', () => {
  it('모든 작업이 하나 이상의 트리거에 있다', () => {
    const scheduled = new Set(TRIGGERS.flatMap((t) => t.jobs));
    expect([...JOB_NAMES].filter((job) => !scheduled.has(job))).toEqual([]);
  });

  it('일일 정산은 서머타임과 관계없이 18:30 CT 평일이다', () => {
    const { cron, timezone } = TRIGGERS.find((t) => t.jobs.includes('DAILY_SETTLE'))!;
    // CDT(UTC-5): 금요일 18:30 CT 다음은 월요일
    expect(nextRun(cron, timezone, '2026-10-23T23:31:00Z')).toBe('2026-10-26T23:30:00.000Z');
    // CST(UTC-6): 월요일 18:00 CT 다음은 같은 날 18:30 CT
    expect(nextRun(cron, timezone, '2026-12-01T00:00:00Z')).toBe('2026-12-01T00:30:00.000Z');
  });

  it('ETP는 08:30 KST다', () => {
    const { cron, timezone } = TRIGGERS.find((t) => t.jobs.includes('ETP'))!;
    expect(nextRun(cron, timezone, '2026-10-27T00:00:00Z')).toBe('2026-10-27T23:30:00.000Z');
  });

  it(':00/:30에는 지연 발송이 장중보다 먼저다(D-026)', () => {
    const trigger = TRIGGERS.find((t) => t.cron === '0,30 * * * *')!;
    expect(trigger.jobs).toEqual(['DEFERRED_PUSH', 'INTRADAY']);
  });
});

describe('createTriggerRunner', () => {
  it('트리거의 작업을 적힌 순서대로 실행하고 등록되지 않은 작업은 건너뛴다', async () => {
    const order: string[] = [];
    const runTrigger = createTriggerRunner({
      store: countingStore(),
      handlers: {
        DEFERRED_PUSH: () => Promise.resolve(void order.push('DEFERRED_PUSH')),
        INTRADAY: () => Promise.resolve(void order.push('INTRADAY')),
      },
    });

    await runTrigger(['DEFERRED_PUSH', 'INTRADAY', 'ETP'], new Date());
    expect(order).toEqual(['DEFERRED_PUSH', 'INTRADAY']);
  });

  it('같은 작업이 실행 중이면 이번 차례를 건너뛴다', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let release!: () => void;
    const handler = vi
      .fn(async () => {})
      .mockImplementationOnce(() => new Promise<void>((resolve) => (release = resolve)));
    const runTrigger = createTriggerRunner({
      store: countingStore(),
      handlers: { INTRADAY: handler },
    });

    const first = runTrigger(['INTRADAY'], new Date());
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await runTrigger(['INTRADAY'], new Date());
    expect(handler).toHaveBeenCalledTimes(1);

    release();
    await first;
    await runTrigger(['INTRADAY'], new Date());
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it('batch_run 기록이 실패해도 다음 작업을 계속한다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const intraday = vi.fn(async () => {});
    const runTrigger = createTriggerRunner({
      store: { ...countingStore(), start: () => Promise.reject(new Error('db down')) },
      handlers: { DEFERRED_PUSH: async () => {}, INTRADAY: intraday },
    });

    await expect(runTrigger(['DEFERRED_PUSH', 'INTRADAY'], new Date())).resolves.toBeUndefined();
    expect(intraday).not.toHaveBeenCalled();
  });
});

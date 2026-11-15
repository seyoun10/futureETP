// 작업 1회 실행 + batch_run 기록 + 실패 시 재시도(D-060). 스케줄러와 CLI가 같이 쓴다.
import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';
import type { JobName } from '../constants.ts';
import { errorMessage } from '../errorMessage.ts';

export { errorMessage };

export type JobContext = {
  // 작업이 기준으로 삼는 시각. CLI에서 기준 시각을 주면 그 값이다.
  readonly now: Date;
  // 작업이 처리하는 CME 거래일. 알면 채운다(운영 알림 거래일당 1회 판단, D-048).
  tradeDate?: string;
};

export type JobHandler = (ctx: JobContext) => Promise<void>;
export type JobHandlers = Partial<Record<JobName, JobHandler>>;

export type FinishedStatus = 'SUCCESS' | 'FAILED';

export interface BatchRunStore {
  start(run: {
    job: JobName;
    scheduledAt: Date | null;
    startedAt: Date;
    attempt: number;
  }): Promise<string>;
  finish(
    id: string,
    result: {
      status: FinishedStatus;
      finishedAt: Date;
      tradeDate: string | null;
      error: string | null;
    },
  ): Promise<void>;
  // 프로세스가 죽어 RUNNING으로 남은 실행을 FAILED로 닫는다. 닫은 개수를 돌려준다.
  failInterrupted(finishedAt: Date): Promise<number>;
}

export type RunOptions = {
  store: BatchRunStore;
  maxAttempts: number;
  retryDelayMs: number;
  // 호출부가 받은 선택 값을 그대로 넘기므로 undefined도 받는다
  scheduledAt?: Date | undefined;
  asOf?: Date | undefined;
  now?: (() => Date) | undefined;
  sleep?: ((ms: number) => Promise<void>) | undefined;
};

export type RunResult = { status: FinishedStatus; runId: string; attempt: number };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// 항목마다 따로 처리한다. 하나가 실패해도 나머지는 끝내고, 실패를 모아 마지막에 던진다
export async function forEachIsolated<T>(
  label: string,
  items: Iterable<T>,
  name: (item: T) => string,
  task: (item: T) => Promise<void>,
): Promise<void> {
  const failures: string[] = [];
  for (const item of items) {
    try {
      await task(item);
    } catch (error) {
      failures.push(`${name(item)}: ${errorMessage(error)}`);
    }
  }
  if (failures.length > 0) throw new Error(`${label} failed: ${failures.join('; ')}`);
}

// 원자재마다 따로 처리한다
export const forEachCommodity = (label: string, task: (code: CommodityCode) => Promise<void>) =>
  forEachIsolated(label, COMMODITY_CODES, (code) => code, task);

// 시도마다 batch_run 행을 하나씩 만든다(attempt 1, 2). 마지막 행의 FAILED가 최종 실패다.
export async function runJob(
  job: JobName,
  handler: JobHandler,
  options: RunOptions,
): Promise<RunResult> {
  const { store, maxAttempts, retryDelayMs, asOf } = options;
  const now = options.now ?? (() => new Date());
  const sleep = options.sleep ?? defaultSleep;

  for (let attempt = 1; ; attempt++) {
    const startedAt = now();
    const ctx: JobContext = { now: asOf ?? startedAt };
    const runId = await store.start({
      job,
      scheduledAt: options.scheduledAt ?? null,
      startedAt,
      attempt,
    });

    let error: unknown;
    try {
      await handler(ctx);
    } catch (e) {
      error = e ?? new Error('Unknown error');
    }
    const status: FinishedStatus = error === undefined ? 'SUCCESS' : 'FAILED';
    await store.finish(runId, {
      status,
      finishedAt: now(),
      tradeDate: ctx.tradeDate ?? null,
      error: error === undefined ? null : errorMessage(error),
    });

    if (status === 'SUCCESS') return { status, runId, attempt };
    console.error(`[job ${job}] attempt ${attempt}/${maxAttempts} failed:`, error);
    if (attempt >= maxAttempts) return { status, runId, attempt };
    await sleep(retryDelayMs);
  }
}

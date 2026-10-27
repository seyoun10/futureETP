// croner 스케줄 등록(D-034, D-060). SCHEDULER_ENABLED일 때만 main.ts가 시작한다.
import { Cron } from 'croner';
import type { JobName } from '../constants.ts';
import { runJob, type BatchRunStore, type JobHandlers } from './runner.ts';

const CHICAGO = 'America/Chicago';
const SEOUL = 'Asia/Seoul';

export type Trigger = { cron: string; timezone: string; jobs: readonly JobName[] };

// 한 트리거의 jobs는 적힌 순서대로 차례로 실행한다.
// :00/:30에는 지연 발송을 장중 판정보다 먼저 처리한다(D-026).
export const TRIGGERS: readonly Trigger[] = [
  { cron: '30 18 * * 1-5', timezone: CHICAGO, jobs: ['DAILY_SETTLE'] },
  { cron: '0,30 * * * *', timezone: CHICAGO, jobs: ['DEFERRED_PUSH', 'INTRADAY'] },
  { cron: '15,45 * * * *', timezone: CHICAGO, jobs: ['INTRADAY'] },
  { cron: '30 8 * * *', timezone: SEOUL, jobs: ['ETP'] },
  // 16:00~17:00 CT 일일 정지 시간에 돈다.
  { cron: '15 16 * * *', timezone: CHICAGO, jobs: ['CALENDAR'] },
  { cron: '30 16 * * *', timezone: CHICAGO, jobs: ['BACKUP'] },
];

// 실패 시 1회 재시도. 일일 정산은 소스 반영이 늦을 때를 위해 더 기다린다(D-019).
export const MAX_ATTEMPTS = 2;
const MINUTE = 60_000;
export const RETRY_DELAY_MS: Record<JobName, number> = {
  DAILY_SETTLE: 15 * MINUTE,
  INTRADAY: MINUTE,
  DEFERRED_PUSH: MINUTE,
  ETP: 10 * MINUTE,
  CALENDAR: 10 * MINUTE,
  BACKUP: 10 * MINUTE,
};

type SchedulerDeps = {
  handlers: JobHandlers;
  store: BatchRunStore;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

// 같은 작업이 아직 실행 중이면(재시도 대기 포함) 이번 차례는 건너뛴다.
export function createTriggerRunner({ handlers, store, now, sleep }: SchedulerDeps) {
  const running = new Set<JobName>();
  return async (jobs: readonly JobName[], scheduledAt: Date): Promise<void> => {
    for (const job of jobs) {
      const handler = handlers[job];
      if (!handler) continue;
      if (running.has(job)) {
        console.warn(`[job ${job}] skipped: previous run still in progress`);
        continue;
      }
      running.add(job);
      try {
        await runJob(job, handler, {
          store,
          maxAttempts: MAX_ATTEMPTS,
          retryDelayMs: RETRY_DELAY_MS[job],
          scheduledAt,
          now,
          sleep,
        });
      } catch (error) {
        // batch_run 기록 자체가 실패한 경우(DB 중단 등). 다음 차례에 다시 돈다.
        console.error(`[job ${job}] run failed to record:`, error);
      } finally {
        running.delete(job);
      }
    }
  };
}

export async function startScheduler(deps: SchedulerDeps): Promise<Cron[]> {
  const interrupted = await deps.store.failInterrupted(new Date());
  if (interrupted > 0) console.warn(`Closed ${interrupted} interrupted batch run(s)`);

  const runTrigger = createTriggerRunner(deps);
  const crons = TRIGGERS.filter((t) => t.jobs.some((job) => deps.handlers[job])).map(
    (t) =>
      new Cron(t.cron, { name: t.jobs.join('+'), timezone: t.timezone }, async (self) => {
        await runTrigger(t.jobs, self.currentRun() ?? new Date());
      }),
  );
  const registered = Object.keys(deps.handlers).join(', ') || 'none';
  console.log(`Scheduler started: ${registered}`);
  return crons;
}

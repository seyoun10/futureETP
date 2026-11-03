// croner 스케줄 등록(D-034, D-060). SCHEDULER_ENABLED일 때만 main.ts가 시작한다.
import { randomUUID } from 'node:crypto';
import { Cron } from 'croner';
import type { JobName } from '../constants.ts';
import type { Healthcheck } from './healthcheck.ts';
import type { OpsAlert } from './opsAlert.ts';
import { runJob, type BatchRunStore, type JobHandlers } from './runner.ts';

const CHICAGO = 'America/Chicago';
const SEOUL = 'Asia/Seoul';

export type Trigger = { cron: string; timezone: string; jobs: readonly JobName[] };

// 한 트리거의 jobs는 적힌 순서대로 차례로 실행한다.
// :00/:30에는 지연 발송을 장중 판정보다 먼저 처리한다(D-026).
// 정산 ①이 끝나야(재시도 포함) 정정 확인 ②가 돈다(D-047, D-071).
export const TRIGGERS: readonly Trigger[] = [
  // 마감(16:00) 뒤, Massive가 드문 월물의 그날 봉을 다음 세션 봉으로 바꾸는 17:00 전에 받는다(D-101).
  { cron: '5 16 * * 1-5', timezone: CHICAGO, jobs: ['DAILY_SETTLE', 'SETTLE_REVISION'] },
  // 세션이 없는 토요일에 지난 정산일의 빠진 봉을 채운다(D-110).
  { cron: '0 10 * * 6', timezone: CHICAGO, jobs: ['SETTLE_BACKFILL'] },
  { cron: '0,30 * * * *', timezone: CHICAGO, jobs: ['DEFERRED_PUSH', 'INTRADAY'] },
  { cron: '15,45 * * * *', timezone: CHICAGO, jobs: ['INTRADAY'] },
  { cron: '30 8 * * *', timezone: SEOUL, jobs: ['ETP'] },
  // 16:00~17:00 CT 일일 정지 시간에 돈다.
  { cron: '15 16 * * *', timezone: CHICAGO, jobs: ['CALENDAR'] },
  { cron: '30 16 * * *', timezone: CHICAGO, jobs: ['BACKUP'] },
];

// 실패 시 1회 재시도. 정산 ①은 실패한 원자재만 다시 받아(원자재당 약 6분) 17:00 CT 전에 끝나도록 짧게 기다리고,
// 정정 확인 ②는 전 거래일 봉이 남아 있어 소스 회복을 더 기다린다(D-101).
export const MAX_ATTEMPTS = 2;
const MINUTE = 60_000;
export const RETRY_DELAY_MS: Record<JobName, number> = {
  DAILY_SETTLE: 5 * MINUTE,
  SETTLE_REVISION: 15 * MINUTE,
  SETTLE_BACKFILL: 15 * MINUTE,
  INTRADAY: MINUTE,
  DEFERRED_PUSH: MINUTE,
  ETP: 10 * MINUTE,
  CALENDAR: 10 * MINUTE,
  BACKUP: 10 * MINUTE,
};

type SchedulerDeps = {
  handlers: JobHandlers;
  store: BatchRunStore;
  // 재시도까지 실패하면 부른다(D-045). 발송기가 없으면 비운다.
  opsAlert?: OpsAlert;
  // 실행 앞뒤 Healthchecks.io 신호(D-045). 키가 없으면(dev) 비운다.
  healthcheck?: Healthcheck;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
};

// 같은 작업이 아직 실행 중이면(재시도 대기 포함) 이번 차례는 건너뛴다(신호도 보내지 않음).
// 신호는 재시도까지 묶어 한 번: 시작 때 /start, 최종 결과로 성공 또는 /fail.
export function createTriggerRunner({
  handlers,
  store,
  opsAlert,
  healthcheck,
  now,
  sleep,
}: SchedulerDeps) {
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
      const pingId = randomUUID();
      try {
        await healthcheck?.(job, 'start', pingId);
        const result = await runJob(job, handler, {
          store,
          maxAttempts: MAX_ATTEMPTS,
          retryDelayMs: RETRY_DELAY_MS[job],
          scheduledAt,
          now,
          sleep,
        });
        await healthcheck?.(job, result.status === 'SUCCESS' ? 'success' : 'fail', pingId);
        if (result.status === 'FAILED' && opsAlert) {
          try {
            await opsAlert(job, result.runId);
          } catch (error) {
            console.error(`[ops ${job}] alert failed:`, error);
          }
        }
      } catch (error) {
        // batch_run 기록 자체가 실패한 경우(DB 중단 등). 다음 차례에 다시 돈다.
        console.error(`[job ${job}] run failed to record:`, error);
        await healthcheck?.(job, 'fail', pingId);
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

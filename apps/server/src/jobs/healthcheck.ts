// Healthchecks.io 신호(D-045, D-053). 스케줄러가 작업 실행(재시도 포함) 앞뒤로 보낸다.
// 서버 중단·VM 회수처럼 스스로 푸시를 못 보낼 때 신호가 끊겨 메일이 온다.
// ping 실패는 배치 결과에 영향을 주지 않는다(로그만 남김). 키가 없으면(dev) 만들지 않는다.
import type { JobName } from '../constants.ts';

const PING_BASE = 'https://hc-ping.com';
const PING_TIMEOUT_MS = 10_000;

export type HealthcheckSignal = 'start' | 'success' | 'fail';

// runId(UUID)로 /start와 끝 신호를 짝지어 실행 시간을 잰다
export type Healthcheck = (job: JobName, signal: HealthcheckSignal, runId: string) => Promise<void>;

// slug는 소문자·숫자·`_`·`-`만 된다: DAILY_SETTLE → daily_settle
export function healthcheckSlug(job: JobName): string {
  return job.toLowerCase();
}

export function healthcheckUrl(
  pingKey: string,
  job: JobName,
  signal: HealthcheckSignal,
  runId: string,
): string {
  const suffix = signal === 'success' ? '' : `/${signal}`;
  return `${PING_BASE}/${pingKey}/${healthcheckSlug(job)}${suffix}?rid=${runId}`;
}

export function createHealthcheck({
  pingKey,
  fetch = globalThis.fetch,
  log = console.warn,
}: {
  pingKey: string;
  fetch?: typeof globalThis.fetch;
  log?: (message: string) => void;
}): Healthcheck {
  return async (job, signal, runId) => {
    try {
      const response = await fetch(healthcheckUrl(pingKey, job, signal, runId), {
        signal: AbortSignal.timeout(PING_TIMEOUT_MS),
      });
      // 키가 든 URL은 남기지 않는다
      if (!response.ok) log(`[healthcheck ${job}] ${signal} ping HTTP ${response.status}`);
    } catch (error) {
      log(`[healthcheck ${job}] ${signal} ping failed: ${(error as Error).name}`);
    }
  };
}

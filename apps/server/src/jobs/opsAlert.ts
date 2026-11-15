// 배치가 재시도까지 실패하면 모든 기기로 운영 알림을 기기별 언어로 보낸다(D-045, D-120).
// 같은 작업은 다시 성공할 때까지 거래일당 1회만 보낸다(batch_run.ops_notified_at, D-048).
import { jobFailedPush } from '@futureetp/shared';
import type { JobName } from '../constants.ts';
import { broadcastOps, type PushDeviceStore } from '../push/broadcast.ts';
import type { PushSender } from '../push/sender.ts';

export interface OpsAlertStore {
  // 이 실행과 같은 작업·거래일(없으면 거래일 없음끼리)로 이미 알렸고, 그 뒤 성공한 실행이 없으면 true
  alreadyNotified(runId: string): Promise<boolean>;
  markNotified(runId: string, at: Date): Promise<void>;
}

export type OpsAlertDeps = {
  store: OpsAlertStore;
  devices: PushDeviceStore;
  sender: PushSender;
  now?: () => Date;
};

export type OpsAlertOutcome = 'SKIPPED' | 'SENT' | 'UNDELIVERED';

// 한 기기에도 전달하지 못하면 표시하지 않아 다음 최종 실패 때 다시 보낸다.
export function createOpsAlert(deps: OpsAlertDeps) {
  const now = deps.now ?? (() => new Date());
  return async (job: JobName, runId: string): Promise<OpsAlertOutcome> => {
    if (await deps.store.alreadyNotified(runId)) return 'SKIPPED';
    return broadcastOps(
      { store: deps.devices, sender: deps.sender },
      (device) => ({
        text: jobFailedPush(device.locale, job),
        data: { type: 'JOB_FAILED', job },
      }),
      {
        label: `[ops ${job}]`,
        log: console.error,
        onDelivered: () => deps.store.markNotified(runId, now()),
      },
    );
  };
}

export type OpsAlert = ReturnType<typeof createOpsAlert>;

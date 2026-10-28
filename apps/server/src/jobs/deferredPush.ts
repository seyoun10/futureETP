// 지연 발송 배치 DEFERRED_PUSH(product.md 6, D-026). :00/:30 CT에 장 상태와 상관없이 INTRADAY보다 먼저 돈다.
// 지난 슬롯의 RETRY 재발송 → 거부 시간이 끝난 HELD 지연 발송 순서다(jobs/rareAlert.ts).
import { batchSlot } from './intraday.ts';
import type { AlertRetry, DeferredAlert } from './rareAlert.ts';
import { errorMessage, type JobHandler } from './runner.ts';

export type DeferredPushDeps = {
  retry: AlertRetry;
  deferred: DeferredAlert;
  log?: (message: string) => void;
};

export function createDeferredPushHandler({
  retry,
  deferred,
  log = console.log,
}: DeferredPushDeps): JobHandler {
  return async (ctx) => {
    // 재발송이 실패해도 지연 발송은 하고, 작업은 마지막에 실패로 남긴다
    let retryFailure: string | null = null;
    try {
      await retry({ before: batchSlot(ctx.now), now: ctx.now });
    } catch (error) {
      retryFailure = `alert retry ${errorMessage(error)}`;
      log(`[deferred] ${retryFailure}`);
    }
    await deferred({ now: ctx.now });
    if (retryFailure !== null) throw new Error(retryFailure);
  };
}

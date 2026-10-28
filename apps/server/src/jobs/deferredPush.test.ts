import { describe, expect, it, vi } from 'vitest';
import { createDeferredPushHandler } from './deferredPush.ts';
import type { JobContext } from './runner.ts';

// 09:30 CT 슬롯, 실제 실행은 5초 뒤
const NOW = new Date('2026-10-28T14:30:05Z');
const run = (handler: ReturnType<typeof createDeferredPushHandler>) => {
  const ctx: JobContext = { now: NOW };
  return handler(ctx).then(() => ctx);
};

describe('DEFERRED_PUSH', () => {
  it('지난 슬롯의 RETRY 재발송 뒤 HELD 지연 발송을 하고 거래일은 남기지 않는다', async () => {
    const order: string[] = [];
    const retry = vi.fn(() => Promise.resolve(void order.push('retry')));
    const deferred = vi.fn(() => Promise.resolve(void order.push('deferred')));
    const ctx = await run(createDeferredPushHandler({ retry, deferred }));

    expect(order).toEqual(['retry', 'deferred']);
    expect(retry).toHaveBeenCalledWith({ before: new Date('2026-10-28T14:30:00Z'), now: NOW });
    expect(deferred).toHaveBeenCalledWith({ now: NOW });
    expect(ctx.tradeDate).toBeUndefined();
  });

  it('재발송이 실패해도 지연 발송은 하고 작업은 실패로 남긴다', async () => {
    const deferred = vi.fn(() => Promise.resolve());
    const handler = createDeferredPushHandler({
      retry: () => Promise.reject(new Error('db down')),
      deferred,
      log: () => {},
    });
    await expect(run(handler)).rejects.toThrow('alert retry db down');
    expect(deferred).toHaveBeenCalled();
  });
});

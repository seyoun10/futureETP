import { describe, expect, it, vi } from 'vitest';
import { createHealthcheck, healthcheckUrl } from './healthcheck.ts';

const RID = '0d4c8f7e-1b2a-4c3d-9e8f-7a6b5c4d3e2f';

describe('healthcheckUrl', () => {
  it('slug는 작업 이름 소문자이고, 성공은 접미사가 없다', () => {
    expect(healthcheckUrl('KEY', 'DAILY_SETTLE', 'start', RID)).toBe(
      `https://hc-ping.com/KEY/daily_settle/start?rid=${RID}`,
    );
    expect(healthcheckUrl('KEY', 'DAILY_SETTLE', 'success', RID)).toBe(
      `https://hc-ping.com/KEY/daily_settle?rid=${RID}`,
    );
    expect(healthcheckUrl('KEY', 'BACKUP', 'fail', RID)).toBe(
      `https://hc-ping.com/KEY/backup/fail?rid=${RID}`,
    );
  });
});

describe('createHealthcheck', () => {
  it('신호를 보낸다', async () => {
    const fetch = vi.fn(() => Promise.resolve(new Response('OK')));
    await createHealthcheck({ pingKey: 'KEY', fetch, log: vi.fn() })('ETP', 'start', RID);
    expect(fetch).toHaveBeenCalledWith(
      `https://hc-ping.com/KEY/etp/start?rid=${RID}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) as unknown }),
    );
  });

  it('응답 오류·네트워크 오류는 던지지 않고 키 없이 로그만 남긴다', async () => {
    const log = vi.fn();
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('not found', { status: 404 }))
      .mockRejectedValueOnce(new TypeError('fetch failed'));
    const ping = createHealthcheck({ pingKey: 'SECRET', fetch, log });

    await expect(ping('ETP', 'success', RID)).resolves.toBeUndefined();
    await expect(ping('ETP', 'fail', RID)).resolves.toBeUndefined();
    expect(log.mock.calls).toEqual([
      ['[healthcheck ETP] success ping HTTP 404'],
      ['[healthcheck ETP] fail ping failed: TypeError'],
    ]);
  });
});

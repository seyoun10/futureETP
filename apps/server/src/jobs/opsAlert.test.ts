import { describe, expect, it, vi } from 'vitest';
import type { PushDevice, PushDeviceStore } from '../push/broadcast.ts';
import { createFakeSender } from '../push/fakeSender.ts';
import { createOpsAlert, type OpsAlertStore } from './opsAlert.ts';

const AT = new Date('2026-10-28T00:00:00Z');

function setup(devices: PushDevice[], alreadyNotified = false) {
  const marked: { runId: string; at: Date }[] = [];
  const store: OpsAlertStore = {
    alreadyNotified: () => Promise.resolve(alreadyNotified),
    markNotified: (runId, at) => Promise.resolve(void marked.push({ runId, at })),
  };
  const deviceStore: PushDeviceStore = {
    list: () => Promise.resolve(devices),
    clearToken: async () => {},
  };
  return { store, deviceStore, marked };
}

const PHONE: PushDevice = { id: 'd1', platform: 'ANDROID', pushToken: 'tok-1' };

describe('createOpsAlert', () => {
  it('저장된 언어로 ops 채널에 보내고 실행에 알림 시각을 남긴다', async () => {
    const { store, deviceStore, marked } = setup([PHONE]);
    const { sender, sent } = createFakeSender();
    const opsAlert = createOpsAlert({
      store,
      devices: deviceStore,
      sender,
      locale: () => Promise.resolve('ko'),
      now: () => AT,
    });

    expect(await opsAlert('DAILY_SETTLE', 'run-2')).toBe('SENT');
    expect(sent).toEqual([
      {
        target: PHONE,
        message: {
          text: { title: '서버 작업 실패: 일일 정산', body: null },
          channel: 'ops',
          data: { type: 'JOB_FAILED', job: 'DAILY_SETTLE' },
        },
      },
    ]);
    expect(marked).toEqual([{ runId: 'run-2', at: AT }]);
  });

  it('이미 알렸으면 보내지 않는다', async () => {
    const { store, deviceStore, marked } = setup([PHONE], true);
    const { sender, sent } = createFakeSender();
    const opsAlert = createOpsAlert({
      store,
      devices: deviceStore,
      sender,
      locale: () => Promise.resolve('ko'),
    });

    expect(await opsAlert('INTRADAY', 'run-3')).toBe('SKIPPED');
    expect(sent).toEqual([]);
    expect(marked).toEqual([]);
  });

  it('한 기기에도 전달하지 못하면 표시하지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { store, deviceStore, marked } = setup([PHONE]);
    const { sender } = createFakeSender({ 'tok-1': { status: 'FAILED', error: 'quota' } });
    const opsAlert = createOpsAlert({
      store,
      devices: deviceStore,
      sender,
      locale: () => Promise.resolve('en'),
    });

    expect(await opsAlert('ETP', 'run-4')).toBe('UNDELIVERED');
    expect(marked).toEqual([]);
  });
});

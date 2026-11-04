import { describe, expect, it, vi } from 'vitest';
import type { PushDevice, PushDeviceStore } from '../push/broadcast.ts';
import { createFakeSender } from '../push/fakeSender.ts';
import {
  createEtpCandidateAlert,
  type EtpCandidate,
  type EtpCandidateAlertStore,
} from './etpCandidateAlert.ts';

const NOW = new Date('2026-10-28T23:30:00Z');
const PHONE: PushDevice = { id: 'd1', platform: 'ANDROID', pushToken: 'tok-1', locale: 'ko' };

function setup(candidates: EtpCandidate[], devices: PushDevice[] = [PHONE]) {
  const store = {
    unnotifiedCandidates: vi.fn(() => Promise.resolve(candidates)),
    markCandidatesNotified: vi.fn<EtpCandidateAlertStore['markCandidatesNotified']>(() =>
      Promise.resolve(),
    ),
  };
  const deviceStore: PushDeviceStore = {
    list: () => Promise.resolve(devices),
    clearToken: async () => {},
  };
  const { sender, sent } = createFakeSender();
  const log = vi.fn();
  const alert = createEtpCandidateAlert({
    store,
    devices: deviceStore,
    sender,
    log,
  });
  return { store, sent, log, alert };
}

describe('createEtpCandidateAlert', () => {
  it('알리지 않은 후보를 한 건으로 묶어 ops 채널로 보내고 알림 시각을 남긴다', async () => {
    const { store, sent, alert } = setup([
      { id: 'p1', ticker: 'NEWG' },
      { id: 'p2', ticker: 'NEWW' },
    ]);

    expect(await alert(NOW)).toBe('SENT');
    expect(sent).toEqual([
      {
        target: PHONE,
        message: {
          text: { title: '미국 ETP 새 후보 2개 · 매핑표 확인 필요', body: 'NEWG, NEWW' },
          channel: 'ops',
          data: { type: 'ETP_CANDIDATES' },
        },
      },
    ]);
    expect(store.markCandidatesNotified).toHaveBeenCalledWith(['p1', 'p2'], NOW);
  });

  it('알릴 후보가 없으면 보내지 않는다', async () => {
    const { store, sent, alert } = setup([]);

    expect(await alert(NOW)).toBe('NONE');
    expect(sent).toEqual([]);
    expect(store.markCandidatesNotified).not.toHaveBeenCalled();
  });

  it('한 기기에도 전달하지 못하면 표시하지 않아 다음 작업 때 다시 보낸다', async () => {
    const { store, log, alert } = setup([{ id: 'p1', ticker: 'NEWG' }], []);

    expect(await alert(NOW)).toBe('UNDELIVERED');
    expect(store.markCandidatesNotified).not.toHaveBeenCalled();
    expect(log).toHaveBeenCalledWith(expect.stringContaining('NEWG not delivered to 0 device(s)'));
  });
});

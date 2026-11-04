import { describe, expect, it, vi } from 'vitest';
import type { PushDevice, PushDeviceStore } from '../push/broadcast.ts';
import { createFakeSender } from '../push/fakeSender.ts';
import {
  createMajorityAlert,
  type MajorityAlertStore,
  type MajorityEtp,
  type RollRuleState,
} from './majorityAlert.ts';

const NOW = new Date('2026-10-28T23:30:00Z');
const PHONE: PushDevice = { id: 'd1', platform: 'ANDROID', pushToken: 'tok-1', locale: 'ko' };

const us = (rollRuleRef: string, aum = 100_000_000): MajorityEtp => ({
  commodityCode: 'CL',
  market: 'US',
  underlyingIndex: null,
  rollRuleRef,
  aum,
});
const kr = (underlyingIndex: string, aum = 10_000_000_000): MajorityEtp => ({
  commodityCode: 'CL',
  market: 'KRX',
  underlyingIndex,
  rollRuleRef: null,
  aum,
});
const rule = (
  basis: RollRuleState['basis'],
  ruleId: string,
  majorityRuleId: string | null = null,
): RollRuleState => ({ commodityCode: 'CL', basis, ruleId, majorityRuleId });

function setup(etps: MajorityEtp[], rules: RollRuleState[], devices: PushDevice[] = [PHONE]) {
  const store = {
    majorityEtps: vi.fn(() => Promise.resolve(etps)),
    rollRules: vi.fn(() => Promise.resolve(rules)),
    setMajority: vi.fn<MajorityAlertStore['setMajority']>(() => Promise.resolve()),
  };
  const deviceStore: PushDeviceStore = {
    list: () => Promise.resolve(devices),
    clearToken: async () => {},
  };
  const { sender, sent } = createFakeSender();
  const log = vi.fn();
  const alert = createMajorityAlert({
    store,
    devices: deviceStore,
    sender,
    log,
  });
  return { store, sent, log, alert };
}

describe('createMajorityAlert', () => {
  it('판정이 적용 중인 규칙과 같으면 기록만 하고 보내지 않는다', async () => {
    const { store, sent, alert } = setup(
      [us('BCBCLI'), us('BCBCLI'), us('USO'), kr('S&P GSCI Crude Oil Index ER')],
      [rule('KR', 'GSCI'), rule('US', 'BCBCLI')],
    );

    expect(await alert(NOW)).toBe('NONE');
    expect(sent).toEqual([]);
    expect(store.setMajority).toHaveBeenCalledWith(
      [
        { commodityCode: 'CL', basis: 'KR', majorityRuleId: 'GSCI' },
        { commodityCode: 'CL', basis: 'US', majorityRuleId: 'BCBCLI' },
      ],
      NOW,
    );
  });

  it('적용 중인 규칙과도 직전 기록과도 다르면 ops 채널로 알리고 기록한다', async () => {
    const { store, sent, alert } = setup(
      [us('USO'), us('USO'), us('BCBCLI'), kr('S&P GSCI Crude Oil Enhanced Index ER')],
      [rule('KR', 'GSCI'), rule('US', 'BCBCLI', 'BCBCLI')],
    );

    expect(await alert(NOW)).toBe('SENT');
    expect(sent).toEqual([
      {
        target: PHONE,
        message: {
          text: {
            title: '다수 판정 변경 2건 · 롤 규칙 확인 필요',
            body: '원유(한국형) GSCI → GSCI_ENHANCED, 원유(미국형) BCBCLI → USO',
          },
          channel: 'ops',
          data: { type: 'MAJORITY_CHANGED' },
        },
      },
    ]);
    expect(store.setMajority).toHaveBeenCalledWith(
      [
        { commodityCode: 'CL', basis: 'KR', majorityRuleId: 'GSCI_ENHANCED' },
        { commodityCode: 'CL', basis: 'US', majorityRuleId: 'USO' },
      ],
      NOW,
    );
  });

  it('이미 알린 판정이면 다시 보내지 않는다', async () => {
    const { store, sent, alert } = setup([us('USO')], [rule('US', 'BCBCLI', 'USO')]);

    expect(await alert(NOW)).toBe('NONE');
    expect(sent).toEqual([]);
    expect(store.setMajority).toHaveBeenCalledWith(
      [{ commodityCode: 'CL', basis: 'US', majorityRuleId: 'USO' }],
      NOW,
    );
  });

  it('셀 상품이 없으면 직전 기록을 둔다', async () => {
    const { store, sent, log, alert } = setup(
      [us('USO', 5_000_000), kr('Bloomberg Gold Subindex')],
      [rule('KR', 'GSCI', 'GSCI'), rule('US', 'BCBCLI', 'BCBCLI')],
    );

    expect(await alert(NOW)).toBe('NONE');
    expect(sent).toEqual([]);
    expect(store.setMajority).toHaveBeenCalledWith([], NOW);
    expect(log).toHaveBeenCalledWith('[etp majority] CL US: no countable ETPs, kept');
  });

  it('한 기기에도 전달하지 못하면 바뀐 판정은 기록하지 않아 다음 작업 때 다시 보낸다', async () => {
    const { store, log, alert } = setup(
      [us('USO'), kr('S&P GSCI Crude Oil Index ER')],
      [rule('KR', 'GSCI'), rule('US', 'BCBCLI', 'BCBCLI')],
      [],
    );

    expect(await alert(NOW)).toBe('UNDELIVERED');
    expect(store.setMajority).toHaveBeenCalledWith(
      [{ commodityCode: 'CL', basis: 'KR', majorityRuleId: 'GSCI' }],
      NOW,
    );
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('BCBCLI → USO not delivered to 0 device(s)'),
    );
  });
});

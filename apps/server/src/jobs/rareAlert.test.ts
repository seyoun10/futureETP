import type { Basis, Settings } from '@futureetp/shared';
import { describe, expect, it, vi } from 'vitest';
import type { PushDeviceStore } from '../push/broadcast.ts';
import { createFakeSender } from '../push/fakeSender.ts';
import type { IndexSnapshotRow } from './intraday.ts';
import { createRareAlert, type NewAlertRecord, type RareAlertStore } from './rareAlert.ts';

// 09:00 KST 슬롯, 실제 실행은 7초 뒤
const SLOT = new Date('2026-10-28T00:00:00Z');
const NOW = new Date('2026-10-28T00:00:07Z');

const SETTINGS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'FRONT',
  maPeriod: 100,
  window: 'Y10',
  rareLevels: [1, 2.5, 5, 10, 20],
  alertCommodity: 'CL',
  quietTime: null,
};

// 0~100 분포: UP p% 레벨 = 100 − p, DOWN p% 레벨 = p
const SORTED = Array.from({ length: 101 }, (_, i) => i);

const index = (basis: Basis, high: number | null, low: number | null): IndexSnapshotRow => {
  const value = { last: null, high: null, low: null };
  return {
    commodityCode: 'CL',
    basis,
    capturedAt: SLOT,
    tradeDate: '2026-10-28',
    open: null,
    high: null,
    low: null,
    last: null,
    disparityByMa: { '20': value, '50': value, '100': { last: null, high, low }, '200': value },
  };
};

type Row = NewAlertRecord & { id: string; sentAt: Date | null };

function setup({
  settings = {},
  suspended = false,
  distribution = SORTED,
  rows = [],
  tokens = { t1: { status: 'SENT' } },
}: {
  settings?: Partial<Settings>;
  suspended?: boolean;
  distribution?: number[] | null;
  rows?: Row[];
  tokens?: Record<string, { status: 'SENT' } | { status: 'FAILED'; error: string }>;
} = {}) {
  const records = [...rows];
  const distributionOf = vi.fn(() => Promise.resolve(distribution));
  const store: RareAlertStore = {
    settings: () => Promise.resolve({ ...SETTINGS, ...settings }),
    isSuspended: () => Promise.resolve(suspended),
    distribution: distributionOf,
    records: (c) =>
      Promise.resolve(
        records.filter(
          (r) =>
            r.commodityCode === c.commodityCode &&
            r.basis === c.basis &&
            r.tradeDate === c.tradeDate,
        ),
      ),
    insert(newRows) {
      const inserted = newRows
        .filter(
          (n) => !records.some((r) => r.direction === n.direction && r.rareLevel === n.rareLevel),
        )
        .map((n, i) => ({ ...n, id: `new-${records.length + i}`, sentAt: null }));
      records.push(...inserted);
      return Promise.resolve(inserted);
    },
    updateStatus(id, status, sentAt) {
      Object.assign(
        records.find((r) => r.id === id)!,
        { status, sentAt },
      );
      return Promise.resolve();
    },
  };
  const devices: PushDeviceStore = {
    list: () =>
      Promise.resolve(
        Object.keys(tokens).map((pushToken) => ({ id: pushToken, platform: 'ANDROID', pushToken })),
      ),
    remove: () => Promise.resolve(),
  };
  const fake = createFakeSender(tokens);
  const log = vi.fn();
  const alert = createRareAlert({ store, devices, sender: fake.sender, log });
  const judge = (indexes: IndexSnapshotRow[], ruleBases: Basis[] = ['FRONT', 'KR', 'US']) =>
    alert({
      commodityCode: 'CL',
      tradeDate: '2026-10-28',
      detectedAt: SLOT,
      now: NOW,
      ruleBases,
      indexes,
    });
  return { judge, records, sent: fake.sent, distributionOf, log };
}

const statuses = (records: Row[]) =>
  records.map((r) => [r.direction, r.rareLevel, r.status]).sort();

describe('rare 레벨 알림 판정', () => {
  it('방향별 가장 드문 레벨 1건을 보내고 나머지는 SUPPRESSED로 남긴다', async () => {
    const { judge, records, sent } = setup();
    // 고가 96 → 상위 5·10·20%, 저가 2 → 하위 2.5·5·10·20%
    await judge([index('FRONT', 96, 2)]);

    expect(statuses(records)).toEqual(
      [
        ['UP', 5, 'SENT'],
        ['UP', 10, 'SUPPRESSED'],
        ['UP', 20, 'SUPPRESSED'],
        ['DOWN', 2.5, 'SENT'],
        ['DOWN', 5, 'SUPPRESSED'],
        ['DOWN', 10, 'SUPPRESSED'],
        ['DOWN', 20, 'SUPPRESSED'],
      ].sort(),
    );
    const up = records.find((r) => r.direction === 'UP' && r.rareLevel === 5)!;
    expect(up).toMatchObject({
      disparity: 96,
      detectedAt: SLOT,
      sentAt: NOW,
      maPeriod: 100,
      window: 'Y10',
    });
    expect(sent.map((s) => s.message)).toEqual([
      {
        text: {
          title: '원유(대표월물) 이격도 상위 5% 도달',
          body: '+96.0%(고가 기준) · 100일선 · 09:00',
        },
        channel: 'alerts',
        data: { type: 'RARE_LEVEL', commodity: 'CL' },
      },
      expect.objectContaining({
        text: {
          title: '원유(대표월물) 이격도 하위 2.5% 도달',
          body: '+2.0%(저가 기준) · 100일선 · 09:00',
        },
      }),
    ]);
  });

  it('이미 기록한 레벨은 다시 보내지 않고, 같은 날 더 드문 레벨에 새로 닿으면 보낸다', async () => {
    const { judge, records, sent } = setup();
    await judge([index('FRONT', 96, null)]);
    await judge([index('FRONT', 96.5, null)]);
    expect(sent).toHaveLength(1);

    await judge([index('FRONT', 99.5, null)]);
    expect(sent).toHaveLength(2);
    expect(sent[1].message.text.title).toBe('원유(대표월물) 이격도 상위 1% 도달');
    expect(statuses(records).filter((r) => r[2] === 'SENT')).toEqual([
      ['UP', 1, 'SENT'],
      ['UP', 5, 'SENT'],
    ]);
  });

  it('거부 시간이면 보내지 않고 HELD로 남긴다', async () => {
    // 09:00 KST는 08:00~10:00 안
    const { judge, records, sent } = setup({
      settings: { quietTime: { startMin: 480, endMin: 600 } },
    });
    await judge([index('FRONT', 96, null)]);
    expect(sent).toHaveLength(0);
    expect(records.find((r) => r.rareLevel === 5)).toMatchObject({ status: 'HELD', sentAt: null });
  });

  it('모든 기기에 실패하면 RETRY로 남긴다', async () => {
    const { judge, records, log } = setup({
      tokens: { t1: { status: 'FAILED', error: 'timeout' } },
    });
    await judge([index('FRONT', 96, null)]);
    expect(records.find((r) => r.rareLevel === 5)).toMatchObject({ status: 'RETRY', sentAt: null });
    expect(log).toHaveBeenCalledWith(expect.stringContaining('ANDROID t1: timeout'));
  });

  it('설정 기준값의 규칙이 없는 원자재는 대표월물로 판정한다', async () => {
    const { judge, records, distributionOf } = setup({ settings: { basis: 'KR' } });
    await judge([index('FRONT', 96, null), index('KR', 50, 50)], ['FRONT']);
    expect(distributionOf).toHaveBeenCalledWith('CL', 'FRONT', 100, 'Y10');
    expect(records.every((r) => r.basis === 'FRONT')).toBe(true);
    expect(records.find((r) => r.rareLevel === 5)?.status).toBe('SENT');
  });

  it.each([
    ['알림 원자재가 아니면', { settings: { alertCommodity: 'GC' as const } }],
    ['알림이 꺼져 있으면', { settings: { alertCommodity: null } }],
    ['정정 확인이 실패해 판정이 멈췄으면', { suspended: true }],
    ['분포가 없으면', { distribution: null }],
  ])('%s 판정하지 않는다', async (_, options) => {
    const { judge, records, sent } = setup(options);
    await judge([index('FRONT', 99.5, 0)]);
    expect(records).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('그 기준값의 잠정 지수가 없으면 판정하지 않는다', async () => {
    const { judge, records, log } = setup({ settings: { basis: 'KR' } });
    await judge([index('FRONT', 99.5, 0)], ['FRONT', 'KR']);
    expect(records).toHaveLength(0);
    expect(log).toHaveBeenCalledWith('[alert CL KR] skipped: no index');
  });
});

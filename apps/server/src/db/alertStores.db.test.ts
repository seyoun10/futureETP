import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './client.ts';
import { createDevicesStore } from './devicesStore.ts';
import { createRareAlertStore } from './rareAlertStore.ts';
import { createRetentionStore } from './retentionStore.ts';
import { alertRecord, batchRun, device } from './schema.ts';
import { createSettingsStore } from './settingsStore.ts';
import { resetDb } from './testDb.ts';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const DETECTED = new Date('2026-10-27T15:00:00Z');

const store = createRareAlertStore(db);
const devices = createDevicesStore(db);
const settings = createSettingsStore(db);
const register = (id: string, pushToken: string) =>
  devices.upsert(id, { pushToken, platform: 'IOS', appVersion: '1.0.0' });

const record = (over: Partial<typeof alertRecord.$inferInsert> = {}) =>
  ({
    deviceId: A,
    commodityCode: 'GC',
    basis: 'FRONT',
    maPeriod: 100,
    window: 'Y10',
    direction: 'UP',
    rareLevel: 4,
    tradeDate: '2026-10-27',
    status: 'SENT',
    disparity: 12.5,
    detectedAt: DETECTED,
    sentAt: null,
    ...over,
  }) as const;

beforeEach(async () => {
  await resetDb(db);
  await register(A, 'token-a');
});
afterAll(() => db.$client.end());

describe('alertDevices', () => {
  it('그 원자재를 고른 기기 중 토큰이 있는 기기만 읽는다', async () => {
    await register(B, 'token-b');
    await settings.update(A, { alertCommodity: 'GC' });
    await settings.update(B, { alertCommodity: 'CL' });
    // 토큰 없는 기기는 같은 원자재를 골라도 빠진다
    await db.insert(device).values({
      id: '00000000-0000-4000-8000-00000000000c',
      alertCommodity: 'GC',
    });

    expect((await store.alertDevices('GC')).map((d) => d.id)).toEqual([A]);
  });
});

describe('insert 중복 방지', () => {
  it('같은 키는 다시 넣지 않고, 새로 들어간 행만 돌려준다', async () => {
    const first = await store.insert([record()]);
    const second = await store.insert([record({ status: 'HELD' }), record({ rareLevel: 8 })]);

    expect(first).toHaveLength(1);
    expect(second.map((r) => r.rareLevel)).toEqual([8]);
    // 먼저 있던 행의 상태는 그대로다
    const rows = await store.records(record());
    expect(rows).toEqual(
      expect.arrayContaining([
        { direction: 'UP', rareLevel: 4, status: 'SENT' },
        { direction: 'UP', rareLevel: 8, status: 'SENT' },
      ]),
    );
  });

  it.each([
    ['방향', { direction: 'DOWN' }],
    ['거래일', { tradeDate: '2026-10-28' }],
    ['원자재', { commodityCode: 'CL' }],
    ['기준값', { basis: 'KR' }],
    ['이평', { maPeriod: 200 }],
    ['기간', { window: 'Y5' }],
  ] as const)('%s이 다르면 다른 알림이다', async (_label, over) => {
    await store.insert([record()]);
    expect(await store.insert([record(over)])).toHaveLength(1);
  });

  it('기기가 달라도 다른 알림이다', async () => {
    await register(B, 'token-b');
    await store.insert([record()]);
    expect(await store.insert([record({ deviceId: B })])).toHaveLength(1);
  });

  it('빈 목록은 빈 결과다', async () => {
    expect(await store.insert([])).toEqual([]);
  });
});

describe('재발송·보류 큐', () => {
  it('retries는 기준 시각 전의 RETRY만 오래된 순으로 읽는다', async () => {
    const [newer, older] = await store.insert([
      record({ status: 'RETRY', rareLevel: 1, detectedAt: new Date('2026-10-27T15:02:00Z') }),
      record({ status: 'RETRY', rareLevel: 2, detectedAt: new Date('2026-10-27T15:01:00Z') }),
    ]);
    await store.insert([
      record({ status: 'RETRY', rareLevel: 4, detectedAt: new Date('2026-10-27T15:10:00Z') }),
      record({ status: 'HELD', rareLevel: 8, detectedAt: new Date('2026-10-27T15:00:00Z') }),
    ]);

    const rows = await store.retries(new Date('2026-10-27T15:05:00Z'));

    expect(rows.map((r) => r.id)).toEqual([older?.id, newer?.id]);
  });

  it('상태를 바꾸면 큐에서 빠진다', async () => {
    const [row] = await store.insert([record({ status: 'HELD' })]);
    expect(await store.held()).toHaveLength(1);

    const sentAt = new Date('2026-10-27T16:00:00Z');
    await store.updateStatus(row?.id ?? '', 'SENT', sentAt);

    expect(await store.held()).toEqual([]);
  });

  it('기기를 지우면 알림 기록도 지운다', async () => {
    await store.insert([record()]);
    await db.delete(device);
    expect(await db.select().from(alertRecord)).toEqual([]);
  });
});

describe('retention.prune', () => {
  it('기준 시각 전 행만 지우고 지운 수를 돌려준다', async () => {
    const started = { job: 'BACKUP', status: 'SUCCESS' } as const;
    await db.insert(batchRun).values([
      { ...started, startedAt: new Date('2026-01-01T00:00:00Z') },
      { ...started, startedAt: new Date('2026-10-01T00:00:00Z') },
    ]);
    await store.insert([
      record({ detectedAt: new Date('2026-01-01T00:00:00Z') }),
      record({ rareLevel: 8, detectedAt: new Date('2026-10-01T00:00:00Z') }),
    ]);

    const deleted = await createRetentionStore(db).prune({
      snapshotsBefore: new Date('2026-06-01T00:00:00Z'),
      recordsBefore: new Date('2026-06-01T00:00:00Z'),
    });

    expect(deleted).toEqual({
      intraday_snapshot: 0,
      index_snapshot: 0,
      alert_record: 1,
      batch_run: 1,
    });
    expect(await db.select().from(batchRun)).toHaveLength(1);
    expect(await db.select().from(alertRecord)).toHaveLength(1);
  });
});

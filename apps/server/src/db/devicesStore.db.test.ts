import { eq } from 'drizzle-orm';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { db } from './client.ts';
import { createDevicesStore, createPushDeviceStore } from './devicesStore.ts';
import { device } from './schema.ts';
import { createSettingsStore } from './settingsStore.ts';
import { resetDb } from './testDb.ts';

const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';

const devices = createDevicesStore(db);
const push = createPushDeviceStore(db);
const settings = createSettingsStore(db);
const registration = (pushToken: string | null) => ({
  pushToken,
  platform: 'ANDROID' as const,
  appVersion: '1.0.0',
});

beforeEach(() => resetDb(db));
afterAll(() => db.$client.end());

describe('devices.upsert', () => {
  it('다른 기기가 쓰던 토큰을 옮겨 오면 이전 행의 토큰을 비운다', async () => {
    await devices.upsert(A, registration('token'));
    await devices.upsert(B, registration('token'));

    expect((await push.list()).map((d) => d.id)).toEqual([B]);
  });

  it('같은 기기가 다시 등록해도 토큰을 유지한다', async () => {
    await devices.upsert(A, registration('token'));
    await devices.upsert(A, registration('token'));

    expect(await push.list()).toEqual([
      { id: A, platform: 'ANDROID', pushToken: 'token', locale: 'ko' },
    ]);
  });

  it('등록은 기기 설정을 지우지 않는다', async () => {
    await settings.update(A, { alertCommodity: 'GC' });
    await devices.upsert(A, registration('token'));

    expect((await settings.get(A)).alertCommodity).toBe('GC');
  });
});

describe('push 대상', () => {
  it('토큰을 비운 기기는 발송 대상에서 빠진다', async () => {
    await devices.upsert(A, registration('token'));
    await push.clearToken(A);

    expect(await push.list()).toEqual([]);
  });

  it('토큰이 있는데 플랫폼이 없는 행은 CHECK로 막는다', async () => {
    await expect(db.insert(device).values({ id: A, pushToken: 'token' })).rejects.toThrow();
  });
});

describe('settings', () => {
  it('처음 보인 기기는 기본값 행을 만들고, 다시 읽어도 행이 늘지 않는다', async () => {
    const first = await settings.get(A);
    await settings.get(A);

    expect(first).toMatchObject({
      locale: 'ko',
      basis: 'FRONT',
      maPeriod: 100,
      window: 'Y10',
      rareLevels: [1, 2, 4, 8, 16],
      alertCommodity: null,
      quietTime: null,
    });
    expect(await db.select().from(device).where(eq(device.id, A))).toHaveLength(1);
  });

  it('보낸 필드만 바꾼다', async () => {
    await settings.update(A, { maPeriod: 200, quietTime: { startMin: 60, endMin: 120 } });
    const updated = await settings.update(A, { window: 'Y5' });

    expect(updated).toMatchObject({
      maPeriod: 200,
      window: 'Y5',
      quietTime: { startMin: 60, endMin: 120 },
    });
  });

  it('quietTime null은 거부 시간을 끈다', async () => {
    await settings.update(A, { quietTime: { startMin: 60, endMin: 120 } });
    expect((await settings.update(A, { quietTime: null })).quietTime).toBeNull();
  });

  it('30분 단위가 아닌 거부 시간은 CHECK로 막는다', async () => {
    await expect(
      settings.update(A, { quietTime: { startMin: 61, endMin: 120 } }),
    ).rejects.toThrow();
  });

  it('소수 한 자리 rare 레벨을 그대로 돌려준다', async () => {
    expect((await settings.update(A, { rareLevels: [0.5, 1.5, 16] })).rareLevels).toEqual([
      0.5, 1.5, 16,
    ]);
  });
});

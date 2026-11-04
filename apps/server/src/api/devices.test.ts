import type { DeviceRegistration } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_CONTRACTS,
  UNUSED_CURVE,
  UNUSED_DISPARITY,
  UNUSED_ETPS,
} from './commodities.fixtures.ts';
import type { DevicesStore } from './devices.ts';
import type { SettingsStore } from './settings.ts';

const TOKEN = 'test-token-0123456789abcdef0123456789';
const ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';

const unused = () => Promise.reject(new Error('unused'));
const UNUSED_SETTINGS: SettingsStore = { get: unused, update: unused };

// DB 대신 받은 기기 id와 등록을 기록한다.
function setup() {
  const registrations: { deviceId: string; registration: DeviceRegistration }[] = [];
  const devices: DevicesStore = {
    upsert: (deviceId, registration) => {
      registrations.push({ deviceId, registration });
      return Promise.resolve({ id: deviceId });
    },
  };
  const app = createApp({
    token: TOKEN,
    checkDb: async () => {},
    settings: UNUSED_SETTINGS,
    commodities: UNUSED_COMMODITIES,
    disparity: UNUSED_DISPARITY,
    curve: UNUSED_CURVE,
    contracts: UNUSED_CONTRACTS,
    devices,
    etps: UNUSED_ETPS,
  });
  const request = (body: string, token = TOKEN, deviceId: string | null = ID) =>
    app.request('/v1/devices', {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(deviceId !== null && { 'X-Device-Id': deviceId }),
      },
      body,
    });
  return { request, registrations };
}

describe('PUT /v1/devices', () => {
  it('헤더 기기에 토큰·플랫폼·앱 버전을 저장하고 기기 id를 돌려준다', async () => {
    const { request, registrations } = setup();
    const res = await request(
      JSON.stringify({ pushToken: ' fcm-token ', platform: 'ANDROID', appVersion: '1.0.0' }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { id: ID } });
    expect(registrations).toEqual([
      {
        deviceId: ID,
        registration: { pushToken: 'fcm-token', platform: 'ANDROID', appVersion: '1.0.0' },
      },
    ]);
  });

  it('토큰이 null이어도 등록한다', async () => {
    const { request, registrations } = setup();
    const res = await request(
      JSON.stringify({ pushToken: null, platform: 'IOS', appVersion: null }),
    );

    expect(res.status).toBe(200);
    expect(registrations).toEqual([
      { deviceId: ID, registration: { pushToken: null, platform: 'IOS', appVersion: null } },
    ]);
  });

  it('기기 헤더가 없으면 400 VALIDATION_FAILED이고 저장하지 않는다', async () => {
    const { request, registrations } = setup();
    const res = await request(
      JSON.stringify({ pushToken: 't', platform: 'IOS', appVersion: null }),
      TOKEN,
      null,
    );
    expect(res.status).toBe(400);
    expect(registrations).toEqual([]);
  });

  it.each([
    ['JSON이 아니면', 'not json'],
    ['토큰이 비었으면', JSON.stringify({ pushToken: ' ', platform: 'IOS', appVersion: null })],
    ['플랫폼이 다르면', JSON.stringify({ pushToken: 't', platform: 'WEB', appVersion: null })],
    ['앱 버전이 빠졌으면', JSON.stringify({ pushToken: 't', platform: 'IOS' })],
    [
      '모르는 필드면',
      JSON.stringify({ pushToken: 't', platform: 'IOS', appVersion: null, locale: 'ko' }),
    ],
  ])('%s 400 VALIDATION_FAILED이고 저장하지 않는다', async (_, body) => {
    const { request, registrations } = setup();
    const res = await request(body);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(registrations).toEqual([]);
  });

  it('접근 키가 틀리면 401이고 저장하지 않는다', async () => {
    const { request, registrations } = setup();
    const res = await request(
      JSON.stringify({ pushToken: 't', platform: 'IOS', appVersion: null }),
      'wrong-token-0123456789abcdef01234567',
    );
    expect(res.status).toBe(401);
    expect(registrations).toEqual([]);
  });
});

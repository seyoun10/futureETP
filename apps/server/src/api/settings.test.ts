import type { Settings } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_CURVE,
  UNUSED_DISPARITY,
  UNUSED_CONTRACTS,
} from './commodities.fixtures.ts';
import type { SettingsStore } from './settings.ts';

const TOKEN = 'test-token-0123456789abcdef0123456789';

const DEFAULTS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'FRONT',
  maPeriod: 100,
  window: 'Y10',
  rareLevels: [5, 10, 15, 20, 25],
  alertCommodity: null,
  quietTime: null,
};

// DB 대신 메모리 한 벌. update는 받은 patch를 기록한다.
function setup() {
  let current = DEFAULTS;
  const patches: unknown[] = [];
  const settings: SettingsStore = {
    get: () => Promise.resolve(current),
    update: (patch) => {
      patches.push(patch);
      current = { ...current, ...patch };
      return Promise.resolve(current);
    },
  };
  const app = createApp({
    token: TOKEN,
    checkDb: async () => {},
    settings,
    commodities: UNUSED_COMMODITIES,
    disparity: UNUSED_DISPARITY,
    curve: UNUSED_CURVE,
    contracts: UNUSED_CONTRACTS,
  });
  const request = (method: string, body?: string) =>
    app.request('/v1/settings', {
      method,
      headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body,
    });
  return { request, patches };
}

describe('GET /v1/settings', () => {
  it('저장된 설정을 돌려준다', async () => {
    const res = await setup().request('GET');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: DEFAULTS });
  });
});

describe('PATCH /v1/settings', () => {
  it('보낸 필드만 저장하고 rare 레벨은 정렬해 전체 설정을 돌려준다', async () => {
    const { request, patches } = setup();
    const res = await request(
      'PATCH',
      JSON.stringify({
        rareLevels: [20, 2.5, 40, 10, 30],
        alertCommodity: 'CL',
        quietTime: { startMin: 1380, endMin: 420 },
      }),
    );

    expect(res.status).toBe(200);
    expect(patches).toEqual([
      {
        rareLevels: [2.5, 10, 20, 30, 40],
        alertCommodity: 'CL',
        quietTime: { startMin: 1380, endMin: 420 },
      },
    ]);
    expect(await res.json()).toEqual({
      success: true,
      data: {
        ...DEFAULTS,
        rareLevels: [2.5, 10, 20, 30, 40],
        alertCommodity: 'CL',
        quietTime: { startMin: 1380, endMin: 420 },
      },
    });
  });

  it.each([
    ['JSON이 아니면', 'not json'],
    ['rare 레벨이 중복이면', JSON.stringify({ rareLevels: [5, 5, 15, 20, 25] })],
    ['모르는 필드면', JSON.stringify({ theme: 'light' })],
    ['시간대가 IANA가 아니면', JSON.stringify({ timezone: 'KST' })],
  ])('%s 400 VALIDATION_FAILED이고 저장하지 않는다', async (_, body) => {
    const { request, patches } = setup();
    const res = await request('PATCH', body);

    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_FAILED' },
    });
    expect(patches).toEqual([]);
  });
});

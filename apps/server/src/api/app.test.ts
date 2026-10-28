import { describe, expect, it, vi } from 'vitest';
import { createApp } from './app.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_CURVE,
  UNUSED_DISPARITY,
  UNUSED_CONTRACTS,
  UNUSED_DEVICES,
} from './commodities.fixtures.ts';
import { ApiException } from './errors.ts';

const TOKEN = 'test-token-0123456789abcdef0123456789';
const auth = { Authorization: `Bearer ${TOKEN}` };

function setup(checkDb: () => Promise<void> = async () => {}) {
  let time = 0;
  const app = createApp({
    token: TOKEN,
    checkDb,
    settings: {
      get: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
    },
    commodities: UNUSED_COMMODITIES,
    disparity: UNUSED_DISPARITY,
    curve: UNUSED_CURVE,
    contracts: UNUSED_CONTRACTS,
    devices: UNUSED_DEVICES,
    dbCheckTimeoutMs: 50,
    authFailureLimit: { maxFailures: 3, windowMs: 1000 },
    now: () => time,
  });
  const request = (path: string, headers: Record<string, string> = {}, ip = '203.0.113.1') =>
    app.request(path, { headers: { 'X-Forwarded-For': ip, ...headers } });
  return { app, request, advance: (ms: number) => (time += ms) };
}

describe('GET /v1/health', () => {
  it('인증 없이 성공 봉투를 보낸다', async () => {
    const res = await setup().request('/v1/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, data: { status: 'ok' } });
  });

  it('DB 확인이 실패하거나 시간을 넘기면 500 INTERNAL', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failing = setup(() => Promise.reject(new Error('ECONNREFUSED')));
    const hanging = setup(() => new Promise(() => {}));

    for (const { request } of [failing, hanging]) {
      const res = await request('/v1/health');
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({
        success: false,
        error: { code: 'INTERNAL', message: 'Database unavailable' },
      });
    }
    expect(log).toHaveBeenCalledTimes(2);
    log.mockRestore();
  });
});

describe('Bearer 인증', () => {
  it('헤더가 없거나 토큰이 틀리면 401 UNAUTHORIZED', async () => {
    const { request } = setup();
    const cases: Record<string, string>[] = [
      {},
      { Authorization: 'Bearer wrong' },
      { Authorization: TOKEN },
    ];
    for (const headers of cases) {
      const res = await request('/v1/settings', headers);
      expect(res.status).toBe(401);
      expect(await res.json()).toMatchObject({
        success: false,
        error: { code: 'UNAUTHORIZED' },
      });
    }
  });

  it('토큰이 맞으면 통과하고, 없는 경로는 404 NOT_FOUND', async () => {
    const res = await setup().request('/v1/nothing', auth);
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('인증 없이 없는 경로를 부르면 경로 존재를 드러내지 않고 401', async () => {
    const res = await setup().request('/v1/nothing');
    expect(res.status).toBe(401);
  });
});

describe('인증 실패 횟수 제한', () => {
  it('창 안에서 한도만큼 실패하면 그 IP는 맞는 토큰도 429, 창이 지나면 풀린다', async () => {
    const { request, advance } = setup();
    for (let i = 0; i < 3; i++) await request('/v1/nothing');

    const blocked = await request('/v1/nothing', auth);
    expect(blocked.status).toBe(429);
    expect(await blocked.json()).toMatchObject({ error: { code: 'RATE_LIMITED' } });

    // 다른 IP와 health는 막히지 않는다.
    expect((await request('/v1/nothing', auth, '198.51.100.7')).status).toBe(404);
    expect((await request('/v1/health')).status).toBe(200);

    advance(1000);
    expect((await request('/v1/nothing', auth)).status).toBe(404);
  });

  it('창이 지난 실패는 세지 않는다', async () => {
    const { request, advance } = setup();
    await request('/v1/nothing');
    await request('/v1/nothing');
    advance(1000);
    await request('/v1/nothing');
    expect((await request('/v1/nothing', auth)).status).toBe(404);
  });

  it('X-Forwarded-For의 가장 오른쪽 값(프록시가 붙인 값)으로 IP를 구분한다', async () => {
    const { request } = setup();
    // 클라이언트가 앞쪽 값을 바꿔도 같은 IP로 센다.
    for (let i = 0; i < 3; i++) await request('/v1/nothing', {}, `10.0.0.${i}, 203.0.113.9`);
    expect((await request('/v1/nothing', auth, '203.0.113.9')).status).toBe(429);
  });
});

describe('onError', () => {
  it('ApiException은 해당 코드·상태, 그 밖의 오류는 500 INTERNAL(메시지 숨김)', async () => {
    const { app, request } = setup();
    app.get('/boom/api', () => {
      throw new ApiException('VALIDATION_FAILED', 'bad input');
    });
    app.get('/boom/raw', () => {
      throw new Error('secret detail');
    });

    const api = await request('/boom/api');
    expect(api.status).toBe(400);
    expect(await api.json()).toEqual({
      success: false,
      error: { code: 'VALIDATION_FAILED', message: 'bad input' },
    });

    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const raw = await request('/boom/raw');
    expect(raw.status).toBe(500);
    expect(await raw.json()).toEqual({
      success: false,
      error: { code: 'INTERNAL', message: 'Internal server error' },
    });
    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });
});

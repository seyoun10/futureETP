import { z } from 'zod';
import { AppError } from './AppError';
import { apiRequest } from './client';

jest.mock('./config', () => ({ apiUrl: 'http://api.test', devApiToken: 'dev-token' }));

const mockGetAccessToken = jest.fn<Promise<string | null>, []>();
jest.mock('./accessToken', () => ({ getAccessToken: () => mockGetAccessToken() }));

const schema = z.object({ price: z.number() });

const respond = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  }) as Response;

let fetchMock: jest.SpiedFunction<typeof fetch>;

// 첫 fetch 호출의 init. 래퍼는 headers를 일반 객체로 넘긴다.
const firstInit = () =>
  fetchMock.mock.calls[0][1] as RequestInit & { headers: Record<string, string> };

beforeEach(() => {
  mockGetAccessToken.mockResolvedValue('dev-token');
  fetchMock = jest.spyOn(globalThis, 'fetch');
});

afterEach(() => {
  fetchMock.mockRestore();
  jest.useRealTimers();
});

const rejection = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('resolved');
    },
    (error: unknown) => error,
  );

describe('apiRequest', () => {
  it('성공 응답의 data를 반환하고 Bearer 헤더·query를 붙인다', async () => {
    fetchMock.mockResolvedValue(respond(200, { success: true, data: { price: 1.5 } }));

    await expect(
      apiRequest('/commodities/GC/disparity', schema, {
        query: { basis: 'KR', ma: 200, x: undefined },
      }),
    ).resolves.toEqual({ price: 1.5 });

    const init = firstInit();
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://api.test/v1/commodities/GC/disparity?basis=KR&ma=200',
    );
    expect(init.headers.Authorization).toBe('Bearer dev-token');
    expect(init.method).toBe('GET');
  });

  it('body는 JSON으로 보낸다', async () => {
    fetchMock.mockResolvedValue(respond(200, { success: true, data: { price: 1 } }));
    await apiRequest('/settings', schema, { method: 'PATCH', body: { locale: 'ko' } });
    const init = firstInit();
    expect(init.body).toBe('{"locale":"ko"}');
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('auth: false면 키 없이도 헤더 없이 보낸다', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    fetchMock.mockResolvedValue(respond(200, { success: true, data: { price: 1 } }));
    await apiRequest('/health', schema, { auth: false });
    expect(firstInit().headers.Authorization).toBeUndefined();
  });

  it('키가 없으면 요청하지 않고 UNAUTHORIZED', async () => {
    mockGetAccessToken.mockResolvedValue(null);
    const error = await rejection(apiRequest('/settings', schema));
    expect(error).toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('에러 봉투는 그 code·status의 AppError', async () => {
    fetchMock.mockResolvedValue(
      respond(404, { success: false, error: { code: 'NOT_FOUND', message: 'no ETP' } }),
    );
    const error = await rejection(apiRequest('/etps/1', schema));
    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ code: 'NOT_FOUND', status: 404, message: 'no ETP' });
  });

  it('data가 스키마와 다르면 SCHEMA_MISMATCH', async () => {
    fetchMock.mockResolvedValue(respond(200, { success: true, data: { price: '1.5' } }));
    expect(await rejection(apiRequest('/x', schema))).toMatchObject({
      code: 'SCHEMA_MISMATCH',
      status: 200,
    });
  });

  it('봉투가 아닌 5xx는 INTERNAL, 그 밖은 SCHEMA_MISMATCH', async () => {
    fetchMock.mockResolvedValueOnce(respond(502, '<html>Bad Gateway</html>'));
    expect(await rejection(apiRequest('/x', schema))).toMatchObject({
      code: 'INTERNAL',
      status: 502,
    });

    fetchMock.mockResolvedValueOnce(respond(200, '<html></html>'));
    expect(await rejection(apiRequest('/x', schema))).toMatchObject({ code: 'SCHEMA_MISMATCH' });

    // 모르는 에러 코드(서버가 더 새 버전)도 봉투 불일치다.
    fetchMock.mockResolvedValueOnce(
      respond(418, { success: false, error: { code: 'TEAPOT', message: 'x' } }),
    );
    expect(await rejection(apiRequest('/x', schema))).toMatchObject({ code: 'SCHEMA_MISMATCH' });
  });

  it('fetch 실패는 NETWORK', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));
    expect(await rejection(apiRequest('/x', schema))).toMatchObject({ code: 'NETWORK' });
  });

  describe('중단', () => {
    // signal이 abort되면 reject하는 fetch
    const hangingFetch = (_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')));
      });

    it('15초가 지나면 TIMEOUT', async () => {
      jest.useFakeTimers();
      fetchMock.mockImplementation(hangingFetch);
      const result = rejection(apiRequest('/x', schema));
      await jest.advanceTimersByTimeAsync(15_000);
      expect(await result).toMatchObject({ code: 'TIMEOUT' });
    });

    it('호출자 취소는 AppError로 바꾸지 않는다', async () => {
      fetchMock.mockImplementation(hangingFetch);
      const controller = new AbortController();
      const result = rejection(apiRequest('/x', schema, { signal: controller.signal }));
      await Promise.resolve();
      await Promise.resolve();
      controller.abort();
      const error = await result;
      expect(error).not.toBeInstanceOf(AppError);
      expect(error).toMatchObject({ message: 'Aborted' });
    });
  });
});

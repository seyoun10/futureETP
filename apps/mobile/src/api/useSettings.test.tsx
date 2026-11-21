import type { Settings, SettingsPatch } from '@futureetp/shared';
import { notifyManager, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppError } from './AppError';
import { createQueryClient } from './queryClient';
import { queryKeys } from './queryKeys';
import { getSettings, patchSettings } from './settings';
import { useSettings, useUpdateSettings } from './useSettings';

jest.mock('./settings', () => ({ getSettings: jest.fn(), patchSettings: jest.fn() }));
const mockGet = jest.mocked(getSettings);
const mockPatch = jest.mocked(patchSettings);

const SERVER: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'FRONT',
  maPeriod: 100,
  window: 'Y10',
  rareLevels: [5, 10, 15, 20, 25],
  alertCommodity: 'CL',
  quietTime: null,
};

// 응답을 테스트가 직접 끝내는 PATCH
const deferPatch = () => {
  let resolve: (settings: Settings) => void = () => {};
  let reject: (error: unknown) => void = () => {};
  mockPatch.mockImplementationOnce(
    () =>
      new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      }),
  );
  return { resolve: (s: Settings) => resolve(s), reject: (e: unknown) => reject(e) };
};

async function renderSettings({ seeded = true } = {}) {
  const queryClient = createQueryClient();
  // 화면이 사라진 뒤 캐시 정리(gc) 타이머가 남아 jest가 끝나지 않는 것을 막는다
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
  if (seeded) queryClient.setQueryData(queryKeys.settings, SERVER);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = await renderHook(
    () => ({ settings: useSettings(), update: useUpdateSettings() }),
    { wrapper },
  );
  const shown = () => result.current.settings.data?.maPeriod;
  const settle = (fn: () => void) =>
    act(async () => {
      fn();
      await new Promise((r) => setTimeout(r, 0));
    });
  const change = (patch: SettingsPatch) => settle(() => result.current.update.mutate(patch));
  return { queryClient, shown, change, settle };
}

// 캐시 알림을 다음 틱으로 미루지 않고 바로 보낸다(알림 시점에 따라 단언이 흔들리지 않게)
beforeAll(() => notifyManager.setScheduler((cb) => cb()));
afterAll(() => notifyManager.setScheduler((cb) => setTimeout(cb, 0)));

beforeEach(() => {
  mockGet.mockReset().mockReturnValue(new Promise(() => {}));
  mockPatch.mockReset();
});

describe('설정 연속 변경(낙관적 갱신)', () => {
  it('바꾼 값을 바로 보여 주고, 캐시에는 서버 응답만 둔다', async () => {
    const first = deferPatch();
    const { queryClient, shown, change, settle } = await renderSettings();
    await change({ maPeriod: 50 });

    expect(shown()).toBe(50);
    expect(queryClient.getQueryData<Settings>(queryKeys.settings)?.maPeriod).toBe(100);
    await settle(() => first.resolve({ ...SERVER, maPeriod: 50 }));
    expect(shown()).toBe(50);
    expect(queryClient.getQueryData<Settings>(queryKeys.settings)?.maPeriod).toBe(50);
  });

  it('둘 다 실패하면 서버 값으로 돌아간다', async () => {
    const first = deferPatch();
    const second = deferPatch();
    const { shown, change, settle } = await renderSettings();
    await change({ maPeriod: 50 });
    await change({ maPeriod: 20 });
    expect(shown()).toBe(20);

    await settle(() => first.reject(new AppError('NETWORK')));
    expect(shown()).toBe(20);
    await settle(() => second.reject(new AppError('NETWORK')));
    expect(shown()).toBe(100);
  });

  it('앞 요청이 먼저 성공해도 뒤 요청이 끝날 때까지 마지막에 바꾼 값을 보여 준다', async () => {
    const first = deferPatch();
    const second = deferPatch();
    const { shown, change, settle } = await renderSettings();
    await change({ maPeriod: 50 });
    await change({ maPeriod: 20 });

    await settle(() => first.resolve({ ...SERVER, maPeriod: 50 }));
    expect(shown()).toBe(20);
    await settle(() => second.resolve({ ...SERVER, maPeriod: 20 }));
    expect(shown()).toBe(20);
  });

  it('앞 요청만 실패하면 뒤 요청의 값을 보여 준다', async () => {
    const first = deferPatch();
    const second = deferPatch();
    const { shown, change, settle } = await renderSettings();
    await change({ maPeriod: 50 });
    await change({ window: 'ALL' });

    await settle(() => first.reject(new AppError('NETWORK')));
    expect(shown()).toBe(100);
    await settle(() => second.resolve({ ...SERVER, window: 'ALL' }));
    expect(shown()).toBe(100);
  });

  // 마운트 재조회처럼 PATCH 뒤에 시작된 GET이 PATCH 반영 전 값을 읽고 늦게 끝나면 새 값을 옛 값으로 덮었다
  it('PATCH 중에 시작된 조회가 늦게 끝나도 새 값을 덮지 않는다', async () => {
    const first = deferPatch();
    const { queryClient, shown, change, settle } = await renderSettings();
    await change({ maPeriod: 50 });

    let resolveGet: (settings: Settings) => void = () => {};
    mockGet.mockImplementationOnce(() => new Promise((res) => (resolveGet = res)));
    await settle(() => void queryClient.refetchQueries({ queryKey: queryKeys.settings }));
    await settle(() => first.resolve({ ...SERVER, maPeriod: 50 }));
    await settle(() => resolveGet(SERVER));

    expect(shown()).toBe(50);
    expect(queryClient.getQueryData<Settings>(queryKeys.settings)?.maPeriod).toBe(50);
  });
});

describe('설정 변경과 다른 조회', () => {
  // 신호를 남기고 끝나지 않는 조회를 시작한다
  const startPending = (
    queryClient: Awaited<ReturnType<typeof renderSettings>>['queryClient'],
    queryKey: readonly unknown[],
  ) => {
    const box: { signal?: AbortSignal } = {};
    void queryClient
      .query({
        queryKey,
        queryFn: ({ signal }) => {
          box.signal = signal;
          return new Promise<never>(() => {});
        },
      })
      .catch(() => {});
    return box;
  };

  it('첫 조회가 끝나기 전에 바꾸면 값을 지어내지 않고 조회를 기다린다', async () => {
    deferPatch();
    const { queryClient, change } = await renderSettings();
    queryClient.removeQueries({ queryKey: queryKeys.settings });
    const { result } = await renderHook(() => useSettings(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      ),
    });
    await change({ maPeriod: 50 });
    expect(result.current.data).toBeUndefined();
  });

  // PATCH가 첫 조회를 끊은 채 실패하면 다시 조회할 계기가 없어 설정이 비어 있는 채로 멈췄다(E3)
  it('첫 조회 중 보낸 PATCH가 실패하면 설정을 다시 조회한다', async () => {
    const first = deferPatch();
    const { shown, change, settle } = await renderSettings({ seeded: false });
    expect(mockGet).toHaveBeenCalledTimes(1);
    await change({ maPeriod: 50 });

    mockGet.mockResolvedValueOnce(SERVER);
    await settle(() => first.reject(new AppError('NETWORK')));
    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(shown()).toBe(100);
  });

  it('연달아 바꾸면 앞 PATCH가 끝난 뒤에 다음 PATCH를 보낸다', async () => {
    const first = deferPatch();
    deferPatch();
    const { change, settle } = await renderSettings();
    await change({ maPeriod: 50 });
    await change({ maPeriod: 20 });
    expect(mockPatch).toHaveBeenCalledTimes(1);

    await settle(() => first.resolve({ ...SERVER, maPeriod: 50 }));
    expect(mockPatch).toHaveBeenCalledTimes(2);
    expect(mockPatch).toHaveBeenLastCalledWith({ maPeriod: 20 });
  });

  it('PATCH를 보낼 때 진행 중인 설정 조회만 끊는다', async () => {
    deferPatch();
    const { queryClient, change, settle } = await renderSettings();
    let settingsSignal: AbortSignal | undefined;
    mockGet.mockImplementationOnce((signal) => {
      settingsSignal = signal;
      return new Promise(() => {});
    });
    await settle(() => void queryClient.refetchQueries({ queryKey: queryKeys.settings }));
    const list = startPending(queryClient, queryKeys.commodities.list());
    await change({ maPeriod: 50 });

    expect(settingsSignal?.aborted).toBe(true);
    expect(list.signal?.aborted).toBe(false);
  });

  it('PATCH가 성공한 뒤에도 설정 조회만 끊는다', async () => {
    const first = deferPatch();
    const { queryClient, change, settle } = await renderSettings();
    await change({ maPeriod: 50 });
    const list = startPending(queryClient, queryKeys.commodities.list());
    await settle(() => first.resolve({ ...SERVER, maPeriod: 50 }));

    expect(list.signal?.aborted).toBe(false);
  });

  it('알림 원자재를 바꾸면 원자재 목록만 다시 조회 대상으로 표시한다', async () => {
    const first = deferPatch();
    const { queryClient, change, settle } = await renderSettings();
    queryClient.setQueryData(queryKeys.commodities.list(), []);
    await change({ alertCommodity: 'GC' });
    await settle(() => first.resolve({ ...SERVER, alertCommodity: 'GC' }));

    expect(queryClient.getQueryState(queryKeys.commodities.list())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(queryKeys.settings)?.isInvalidated).toBe(false);
  });

  it('알림 원자재가 아닌 값을 바꾸면 원자재 목록은 그대로 둔다', async () => {
    const first = deferPatch();
    const { queryClient, change, settle } = await renderSettings();
    queryClient.setQueryData(queryKeys.commodities.list(), []);
    await change({ maPeriod: 50 });
    await settle(() => first.resolve({ ...SERVER, maPeriod: 50 }));

    expect(queryClient.getQueryState(queryKeys.commodities.list())?.isInvalidated).toBe(false);
  });
});

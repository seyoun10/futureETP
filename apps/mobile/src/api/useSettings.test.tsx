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

async function renderSettings() {
  const queryClient = createQueryClient();
  // 화면이 사라진 뒤 캐시 정리(gc) 타이머가 남아 jest가 끝나지 않는 것을 막는다
  const defaults = queryClient.getDefaultOptions();
  queryClient.setDefaultOptions({
    queries: { ...defaults.queries, gcTime: Infinity },
    mutations: { ...defaults.mutations, gcTime: Infinity },
  });
  queryClient.setQueryData(queryKeys.settings, SERVER);
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

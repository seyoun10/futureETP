import type { Calendar } from 'expo-localization';
import type { Settings } from '@futureetp/shared';
import { getCalendars } from 'expo-localization';
import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { queryClient } from '@/api/queryClient';
import { queryKeys } from '@/api/queryKeys';
import { getSettings, patchSettings } from '@/api/settings';

jest.mock('@/api/settings', () => ({ getSettings: jest.fn(), patchSettings: jest.fn() }));
const mockGet = jest.mocked(getSettings);
const mockPatch = jest.mocked(patchSettings);
const mockCalendars = jest.mocked(getCalendars);

const SETTINGS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'FRONT',
  maPeriod: 100,
  window: 'Y10',
  rareLevels: [5, 10, 15, 20, 25],
  alertCommodity: 'CL',
  quietTime: null,
};

const setDeviceTimezone = (timeZone: string | null) =>
  mockCalendars.mockReturnValue([{ timeZone } as Calendar]);

beforeEach(() => {
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockGet.mockReset().mockResolvedValue(SETTINGS);
  mockPatch.mockReset().mockImplementation((patch) => Promise.resolve({ ...SETTINGS, ...patch }));
});

afterEach(() => setDeviceTimezone('Asia/Seoul'));

// B 화면은 아무 query도 부르지 않는 빈 화면으로 바꿔 루트 레이아웃의 동작만 본다
const renderApp = () =>
  renderRouter(
    {
      appDir: 'src/app',
      overrides: { 'settings/index': () => null },
    },
    { initialUrl: '/settings' },
  );

// 설정 조회가 끝나고 effect가 돌 때까지 기다린다
const settle = async () => {
  await waitFor(() =>
    expect(queryClient.getQueryState(queryKeys.settings)?.status).toBe('success'),
  );
  await act(() => Promise.resolve());
};

describe('앱 실행 때 시간대 PATCH', () => {
  it('기기 시간대가 서버 값과 다르면 시간대만 보낸다', async () => {
    setDeviceTimezone('Europe/London');
    await renderApp();

    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith({ timezone: 'Europe/London' }));
    expect(mockPatch).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(queryClient.getQueryData(queryKeys.settings)).toMatchObject({
        timezone: 'Europe/London',
      }),
    );
  });

  it.each([
    ['같으면', 'Asia/Seoul'],
    ['읽지 못하면', null],
    ['IANA 이름이 아니면', 'Not/AZone'],
  ])('기기 시간대가 %s 보내지 않는다', async (_case, timeZone) => {
    setDeviceTimezone(timeZone);
    await renderApp();
    await settle();

    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('접근 키가 없으면 조회하지 않는다', async () => {
    setDeviceTimezone('Europe/London');
    useAccessKeyStore.setState({ key: null });
    await renderApp();
    await act(() => Promise.resolve());

    expect(mockGet).not.toHaveBeenCalled();
    expect(mockPatch).not.toHaveBeenCalled();
  });

  it('보내기에 실패해도 같은 시간대를 되풀이해 보내지 않는다', async () => {
    setDeviceTimezone('Europe/London');
    mockPatch.mockRejectedValue(new AppError('NETWORK'));
    await renderApp();

    await waitFor(() => expect(mockPatch).toHaveBeenCalledTimes(1));
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.settings }));
    await settle();
    expect(mockPatch).toHaveBeenCalledTimes(1);
  });

  it('다시 조회했을 때 시간대가 또 바뀌었으면 그 값을 보낸다', async () => {
    await renderApp();
    await settle();
    expect(mockPatch).not.toHaveBeenCalled();

    setDeviceTimezone('America/Chicago');
    await act(() => queryClient.refetchQueries({ queryKey: queryKeys.settings }));
    await waitFor(() => expect(mockPatch).toHaveBeenCalledWith({ timezone: 'America/Chicago' }));
  });
});

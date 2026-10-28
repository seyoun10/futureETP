import type { Settings } from '@futureetp/shared';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState, Linking } from 'react-native';
import { useAccessKeyStore } from '@/api/accessToken';
import { queryClient } from '@/api/queryClient';
import { AppError } from '@/api/AppError';
import { getSettings, patchSettings } from '@/api/settings';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('@/api/settings', () => ({ getSettings: jest.fn(), patchSettings: jest.fn() }));

type Permission = Awaited<ReturnType<typeof getPermissionsAsync>>;
const permission = (granted: boolean, canAskAgain: boolean) =>
  ({ granted, canAskAgain }) as Permission;

beforeEach(() => {
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  useDisplaySettings.setState({ language: 'ko' });
  queryClient.clear();
  jest.mocked(getSettings).mockReturnValue(new Promise(() => {}));
  jest.mocked(getPermissionsAsync).mockResolvedValue(permission(true, true));
});

const renderAlertSettings = () => renderRouter('src/app', { initialUrl: '/settings/alerts' });

describe('B-a 알림 권한', () => {
  it('권한이 있으면 경고 없이 안내 문구만 보여 준다', async () => {
    await renderAlertSettings();

    expect(screen.getByRole('header', { name: '알림 설정' })).toBeOnTheScreen();
    expect(screen.getByText(/CME 거래일당 1회/)).toBeOnTheScreen();
    expect(screen.queryByText(/알림 권한이 꺼져/)).not.toBeOnTheScreen();
  });

  it('다시 물을 수 있으면 [허용]으로 권한 창을 띄우고, 허용되면 경고를 지운다', async () => {
    jest.mocked(getPermissionsAsync).mockResolvedValue(permission(false, true));
    jest.mocked(requestPermissionsAsync).mockResolvedValueOnce(permission(true, true));
    await renderAlertSettings();

    await fireEvent.press(await screen.findByText('허용'));
    expect(requestPermissionsAsync).toHaveBeenCalled();
    expect(screen.queryByText(/알림 권한이 꺼져/)).not.toBeOnTheScreen();
  });

  it('영구 거부면 [설정 열기]로 앱 설정을 열고, 돌아오면 권한을 다시 읽는다', async () => {
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue();
    const addListener = jest.spyOn(AppState, 'addEventListener');
    jest.mocked(getPermissionsAsync).mockResolvedValue(permission(false, false));
    await renderAlertSettings();

    await fireEvent.press(await screen.findByText('설정 열기'));
    expect(openSettings).toHaveBeenCalled();

    jest.mocked(getPermissionsAsync).mockResolvedValue(permission(true, false));
    // 다른 모듈도 AppState를 들으므로 등록된 change 리스너를 모두 부른다
    const listeners = addListener.mock.calls.filter(([type]) => type === 'change');
    await act(() => listeners.forEach(([, listener]) => listener('active')));
    await waitFor(() => expect(screen.queryByText(/알림 권한이 꺼져/)).not.toBeOnTheScreen());
  });
});

const SETTINGS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'US',
  maPeriod: 100,
  window: 'Y10',
  rareLevels: [5, 10, 15, 20, 25],
  alertCommodity: 'CL',
  quietTime: null,
};

describe('B-a 대상 원자재·적용 기준', () => {
  beforeEach(() => {
    jest.mocked(getSettings).mockResolvedValue(SETTINGS);
    // 서버처럼 바꾼 값을 쌓아 둔다
    let saved = SETTINGS;
    jest.mocked(patchSettings).mockImplementation((patch) => {
      saved = { ...saved, ...patch };
      return Promise.resolve(saved);
    });
  });

  it('대상 원자재를 고른 상태로 보여 주고 B 이격도차트 설정을 요약한다', async () => {
    await renderAlertSettings();

    expect(await screen.findByRole('radio', { name: '원유', checked: true })).toBeOnTheScreen();
    expect(screen.getByText('기준값 미국형 · 100일선 · 10년')).toBeOnTheScreen();
    expect(screen.getByText('레벨 5/10/15/20/25% (위·아래)')).toBeOnTheScreen();
  });

  it('분포 기간이 전체면 전체로 쓴다', async () => {
    jest
      .mocked(getSettings)
      .mockResolvedValue({ ...SETTINGS, window: 'ALL', alertCommodity: null });
    await renderAlertSettings();

    expect(await screen.findByText('기준값 미국형 · 100일선 · 전체')).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '없음', checked: true })).toBeOnTheScreen();
  });

  it('[없음]은 알림 끔(null)으로, 원자재는 그 코드로 저장한다', async () => {
    await renderAlertSettings();
    await fireEvent.press(await screen.findByRole('radio', { name: '없음' }));
    expect(await screen.findByRole('radio', { name: '없음', checked: true })).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: '천연가스' }));

    await waitFor(() => expect(patchSettings).toHaveBeenCalledTimes(2));
    expect(jest.mocked(patchSettings).mock.calls.map(([patch]) => patch)).toEqual([
      { alertCommodity: null },
      { alertCommodity: 'NG' },
    ]);
    expect(await screen.findByRole('radio', { name: '천연가스', checked: true })).toBeOnTheScreen();
  });

  it('저장에 실패하면 되돌리고 오류 줄을 보여 준다', async () => {
    jest.mocked(patchSettings).mockRejectedValue(new AppError('NETWORK'));
    await renderAlertSettings();
    await fireEvent.press(await screen.findByRole('radio', { name: '금' }));

    expect(await screen.findByText(/저장하지 못했습니다/)).toBeOnTheScreen();
    expect(screen.getByRole('radio', { name: '원유', checked: true })).toBeOnTheScreen();
  });
});

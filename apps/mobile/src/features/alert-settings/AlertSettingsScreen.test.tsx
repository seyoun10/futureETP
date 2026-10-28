import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AppState, Linking } from 'react-native';
import { useAccessKeyStore } from '@/api/accessToken';
import { queryClient } from '@/api/queryClient';
import { getSettings } from '@/api/settings';
import { useDisplaySettings } from '@/stores/displaySettings';

// 루트 레이아웃의 시간대 동기화가 설정을 조회한다
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

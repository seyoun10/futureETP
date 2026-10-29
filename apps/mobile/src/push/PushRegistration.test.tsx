import { addPushTokenListener, getDevicePushTokenAsync } from 'expo-notifications';
import { act, renderRouter, waitFor } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { registerDevice } from '@/api/devices';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('@/api/devices', () => ({ registerDevice: jest.fn() }));
const mockRegister = jest.mocked(registerDevice);
const mockToken = jest.mocked(getDevicePushTokenAsync);
const mockTokenListener = jest.mocked(addPushTokenListener);

beforeEach(() => {
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  mockRegister.mockReset().mockResolvedValue({ id: '00000000-0000-4000-8000-000000000000' });
  mockToken.mockResolvedValue({ type: 'ios', data: 'apns-token' });
});

afterEach(() => mockToken.mockResolvedValue({ type: 'ios', data: '' }));

// 화면은 query를 부르지 않는 빈 화면으로 바꿔 루트 레이아웃의 동작만 본다
const renderApp = () =>
  renderRouter({ appDir: 'src/app', overrides: { index: () => null } }, { initialUrl: '/' });

describe('앱 실행 때 기기 등록', () => {
  it('접근 키가 있으면 한 번 등록하고, 언어가 바뀌어도 다시 등록하지 않는다', async () => {
    await renderApp();
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({ pushToken: 'apns-token', platform: 'IOS' }),
    );

    const { language } = useDisplaySettings.getState();
    await act(() => useDisplaySettings.setState({ language: language === 'ko' ? 'en' : 'ko' }));
    await act(() => Promise.resolve());
    expect(mockRegister).toHaveBeenCalledTimes(1);
    await act(() => useDisplaySettings.setState({ language }));
  });

  it('접근 키가 없으면 등록하지 않는다', async () => {
    useAccessKeyStore.setState({ key: null });
    await renderApp();
    await act(() => Promise.resolve());
    expect(mockRegister).not.toHaveBeenCalled();
  });
});

describe('토큰 변경 때 다시 등록', () => {
  // 마지막으로 붙은 토큰 리스너에 이벤트를 보낸다
  const emitToken = async (data: string) => {
    const listener = mockTokenListener.mock.calls.at(-1)?.[0];
    await act(() => listener?.({ type: 'android', data }));
  };

  it('이벤트의 토큰을 다시 조회하지 않고 등록하며, 같은 토큰은 건너뛴다', async () => {
    await renderApp();
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    const fetches = mockToken.mock.calls.length;

    // Android의 getDevicePushTokenAsync가 내는 같은 토큰 이벤트(무한 반복의 원인)
    await emitToken('apns-token');
    expect(mockRegister).toHaveBeenCalledTimes(1);

    await emitToken('new-token');
    await emitToken('new-token');
    expect(mockRegister).toHaveBeenCalledTimes(2);
    expect(mockRegister).toHaveBeenLastCalledWith(
      expect.objectContaining({ pushToken: 'new-token' }),
    );
    expect(mockToken).toHaveBeenCalledTimes(fetches);
  });

  it('다시 등록이 실패하면 같은 토큰 이벤트 때 다시 시도한다', async () => {
    await renderApp();
    await waitFor(() => expect(mockRegister).toHaveBeenCalledTimes(1));
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRegister.mockRejectedValueOnce(new Error('offline'));

    await emitToken('new-token');
    await emitToken('new-token');
    expect(mockRegister).toHaveBeenCalledTimes(3);
  });
});

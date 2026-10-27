import { getItemAsync } from 'expo-secure-store';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { verifyAccessKey } from '@/api/verifyAccessKey';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('@/api/verifyAccessKey', () => ({ verifyAccessKey: jest.fn() }));
const mockVerify = jest.mocked(verifyAccessKey);
const { mockRequestCameraPermission } = jest.requireMock<{
  mockRequestCameraPermission: jest.Mock<Promise<{ granted: boolean }>, []>;
}>('expo-camera');

const KEY = 'k'.repeat(43);

beforeEach(() => {
  useDisplaySettings.getState().setLanguage('ko');
  useAccessKeyStore.setState({ key: null });
  mockVerify.mockReset().mockResolvedValue(undefined);
  mockRequestCameraPermission.mockClear().mockResolvedValue({ granted: true });
});

const renderApp = (initialUrl = '/') =>
  renderRouter({ appDir: 'src/app', overrides: { 'dev/chart-spike': () => null } }, { initialUrl });

const enterKey = async (input: string) => {
  await fireEvent.changeText(screen.getByLabelText('키 붙여넣기'), input);
  await fireEvent.press(screen.getByRole('button', { name: '확인' }));
};

const openScanner = async () => {
  await fireEvent.press(screen.getByRole('button', { name: 'QR 읽기' }));
  return screen.getByLabelText('QR 카메라');
};

describe('B-b 접근 키', () => {
  it('키가 없으면 A 대신 [←] 없는 B-b를 띄우고, 확인된 키를 저장하면 A로 간다', async () => {
    await renderApp();
    expect(screen.getByRole('header', { name: '접근 키' })).toBeOnTheScreen();
    expect(screen.queryByLabelText('뒤로')).not.toBeOnTheScreen();
    expect(screen.queryByText('원유 / CL')).not.toBeOnTheScreen();

    await enterKey(`futureetp-key:v1:${KEY}`);

    expect(mockVerify).toHaveBeenCalledWith(KEY);
    await expect(getItemAsync('access-key')).resolves.toBe(KEY);
    expect(await screen.findByText('원유 / CL')).toBeOnTheScreen();
  });

  it('형식이 아니면 서버에 묻지 않는다', async () => {
    await renderApp();
    await enterKey('not-a-key');

    expect(screen.getByRole('alert')).toHaveTextContent('키 형식이 맞지 않습니다.');
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it.each([
    ['서버가 거절하면', new AppError('UNAUTHORIZED'), '키가 맞지 않습니다.'],
    ['네트워크 오류면', new AppError('NETWORK'), '네트워크에 연결할 수 없습니다.'],
  ])('%s 저장하지 않고 오류를 보여 준다', async (_, error, message) => {
    mockVerify.mockRejectedValue(error);
    await renderApp();
    await enterKey(KEY);

    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(useAccessKeyStore.getState().key).toBeNull();
  });

  it('B에서 들어오면 [←]가 있고, 저장하면 B로 돌아간다', async () => {
    useAccessKeyStore.setState({ key: 'old-key' });
    await renderApp('/settings');
    expect(screen.getByText('설정됨')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('접근 키'));
    expect(screen.getByLabelText('뒤로')).toBeOnTheScreen();
    await enterKey(KEY);

    expect(screen).toHavePathname('/settings');
    expect(useAccessKeyStore.getState().key).toBe(KEY);
  });

  describe('QR 읽기', () => {
    it('접두사가 있는 QR을 읽으면 한 번만 확인하고 저장한다', async () => {
      await renderApp();
      const camera = await openScanner();
      await fireEvent(camera, 'barcodeScanned', { data: `futureetp-key:v1:${KEY}` });
      await fireEvent(camera, 'barcodeScanned', { data: `futureetp-key:v1:${KEY}` });

      expect(mockVerify).toHaveBeenCalledTimes(1);
      expect(mockVerify).toHaveBeenCalledWith(KEY);
      expect(await screen.findByText('원유 / CL')).toBeOnTheScreen();
    });

    it('접두사가 없는 QR은 받지 않고 계속 읽는다', async () => {
      await renderApp();
      const camera = await openScanner();
      await fireEvent(camera, 'barcodeScanned', { data: KEY });

      expect(screen.getByRole('alert')).toHaveTextContent('접근 키 QR이 아닙니다.');
      expect(mockVerify).not.toHaveBeenCalled();
      expect(screen.getByLabelText('QR 카메라')).toBeOnTheScreen();
    });

    it('[취소]하면 카메라를 닫는다', async () => {
      await renderApp();
      await openScanner();
      await fireEvent.press(screen.getByRole('button', { name: '취소' }));

      expect(screen.queryByLabelText('QR 카메라')).not.toBeOnTheScreen();
    });

    it('권한이 거부되면 붙여넣기를 안내하고, 붙여넣기는 그대로 쓴다', async () => {
      mockRequestCameraPermission.mockResolvedValue({ granted: false });
      await renderApp();
      await fireEvent.press(screen.getByRole('button', { name: 'QR 읽기' }));

      expect(screen.queryByLabelText('QR 카메라')).not.toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(/카메라를 쓸 수 없습니다/);

      await enterKey(KEY);
      expect(mockVerify).toHaveBeenCalledWith(KEY);
    });

    it('카메라를 열지 못하면(시뮬레이터) 닫고 붙여넣기를 안내한다', async () => {
      await renderApp();
      const camera = await openScanner();
      await fireEvent(camera, 'mountError', { message: 'no camera' });

      expect(screen.queryByLabelText('QR 카메라')).not.toBeOnTheScreen();
      expect(screen.getByRole('alert')).toHaveTextContent(/카메라를 쓸 수 없습니다/);
    });
  });
});

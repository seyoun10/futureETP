import { getItemAsync } from 'expo-secure-store';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { AppError } from '@/api/AppError';
import { queryClient } from '@/api/queryClient';
import { verifyAccessKey } from '@/api/verifyAccessKey';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('@/api/verifyAccessKey', () => ({ verifyAccessKey: jest.fn() }));
// B가 설정을 조회하므로 서버에 가지 않게 막는다(B 화면 테스트는 SettingsScreen.test).
jest.mock('@/api/settings', () => ({
  getSettings: () =>
    Promise.resolve({
      locale: 'ko',
      timezone: 'Asia/Seoul',
      basis: 'FRONT',
      maPeriod: 100,
      window: 'Y10',
      rareLevels: [5, 10, 15, 20, 25],
      alertCommodity: null,
      quietTime: null,
    }),
  patchSettings: jest.fn(),
}));
// A는 원자재 목록을 조회한다. 화면 이동만 보므로 목록은 비운다.
// 키 저장 뒤 무효화가 다시 조회를 기다리므로 응답은 와야 한다.
jest.mock('@/api/commodities', () => ({
  getCommodities: () =>
    Promise.resolve({
      freshness: {
        asOf: '2026-10-22T14:45:00Z',
        tradeDate: '2026-10-22',
        delayed: false,
        marketState: 'OPEN',
        nextUpdateAt: null,
      },
      commodities: [],
    }),
}));
const mockVerify = jest.mocked(verifyAccessKey);
const { mockRequestCameraPermission } = jest.requireMock<{
  mockRequestCameraPermission: jest.Mock<Promise<{ granted: boolean }>, []>;
}>('expo-camera');

const KEY = 'k'.repeat(43);

beforeEach(() => {
  useDisplaySettings.getState().setLanguage('ko');
  useAccessKeyStore.setState({ key: null, rejected: false });
  queryClient.clear();
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
    expect(screen.queryByRole('header', { name: 'futureETP' })).not.toBeOnTheScreen();

    await enterKey(`futureetp-key:v1:${KEY}`);

    expect(mockVerify).toHaveBeenCalledWith(KEY);
    await expect(getItemAsync('access-key')).resolves.toBe(KEY);
    expect(await screen.findByRole('header', { name: 'futureETP' })).toBeOnTheScreen();
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
      expect(await screen.findByRole('header', { name: 'futureETP' })).toBeOnTheScreen();
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

  describe('저장된 키 거절', () => {
    // 화면의 조회가 저장된 키로 UNAUTHORIZED를 받은 경우
    const failQuery = (code: 'UNAUTHORIZED' | 'NOT_FOUND') =>
      act(() =>
        queryClient.prefetchQuery({
          queryKey: ['test', code],
          queryFn: () => Promise.reject(new AppError(code)),
        }),
      );

    it('어느 화면에서든 B-b로 와서 오류 줄을 보여 주고, 키는 지우지 않는다', async () => {
      useAccessKeyStore.setState({ key: 'old-key' });
      await renderApp('/commodity/CL/curve');
      await failQuery('UNAUTHORIZED');

      expect(screen).toHavePathname('/settings/access-key');
      expect(screen.getByRole('alert')).toHaveTextContent('키가 맞지 않습니다.');
      expect(useAccessKeyStore.getState().key).toBe('old-key');

      // 새 키 없이 [←]로 떠나면 들어온 화면이고, 다시 거절되면 또 B-b로 온다.
      await fireEvent.press(screen.getByLabelText('뒤로'));
      expect(screen).toHavePathname('/commodity/CL/curve');
      await failQuery('UNAUTHORIZED');
      expect(screen).toHavePathname('/settings/access-key');
    });

    it('새 키를 저장하면 오류 줄을 지우고 들어온 화면으로 돌아간다', async () => {
      useAccessKeyStore.setState({ key: 'old-key' });
      await renderApp('/commodity/GC');
      await failQuery('UNAUTHORIZED');
      await enterKey(KEY);

      expect(screen).toHavePathname('/commodity/GC');
      expect(useAccessKeyStore.getState()).toMatchObject({ key: KEY, rejected: false });
    });

    it('UNAUTHORIZED가 아니면 이동하지 않는다', async () => {
      useAccessKeyStore.setState({ key: 'old-key' });
      await renderApp('/commodity/GC');
      await failQuery('NOT_FOUND');

      expect(screen).toHavePathname('/commodity/GC');
    });

    it('B-b에서 새 키가 거절된 것은 저장된 키 거절로 보지 않는다', async () => {
      useAccessKeyStore.setState({ key: 'old-key' });
      mockVerify.mockRejectedValue(new AppError('UNAUTHORIZED'));
      await renderApp('/settings/access-key');
      await enterKey(KEY);

      expect(await screen.findByRole('alert')).toHaveTextContent('키가 맞지 않습니다.');
      expect(useAccessKeyStore.getState()).toMatchObject({ key: 'old-key', rejected: false });
    });
  });
});

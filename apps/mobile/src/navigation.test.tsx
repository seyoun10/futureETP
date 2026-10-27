import { lockAsync, OrientationLock } from 'expo-screen-orientation';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { getCommodities } from '@/api/commodities';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('expo-screen-orientation', () => ({
  ...jest.requireActual<typeof import('expo-screen-orientation')>('expo-screen-orientation'),
  lockAsync: jest.fn(() => Promise.resolve()),
}));

// A는 원자재 목록을 조회한다. 이동만 보므로 월물 줄은 비운다.
jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn() }));

// 창 모양은 테스트마다 바꾼다(가로 레이아웃 판정).
const mockWindow = { width: 390, height: 844 };
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ ...mockWindow, scale: 3, fontScale: 1 }),
}));

// Jest 기기 언어는 영어라 문구 확인을 위해 한국어로 고정한다.
beforeEach(() => {
  useDisplaySettings.getState().setLanguage('ko');
  // 키가 없으면 B-b만 뜨므로 키가 있는 상태로 시작한다.
  useAccessKeyStore.setState({ key: 'test-key' });
  Object.assign(mockWindow, { width: 390, height: 844 });
  jest.mocked(lockAsync).mockClear();
  jest.mocked(getCommodities).mockResolvedValue({
    freshness: {
      asOf: '2026-10-22T14:45:00Z',
      tradeDate: '2026-10-22',
      delayed: false,
      marketState: 'OPEN',
      nextUpdateAt: null,
    },
    commodities: (['GC', 'SI', 'CL', 'NG'] as const).map((code) => ({
      code,
      priceDecimals: 2,
      alert: false,
      contracts: [],
    })),
  });
});

// 실제 src/app 라우트 트리로 화면 이동을 확인한다. 스파이크 화면은 Skia를 불러오므로 뺀다.
const renderApp = (initialUrl = '/') =>
  renderRouter({ appDir: 'src/app', overrides: { 'dev/chart-spike': () => null } }, { initialUrl });

describe('라우트 골격', () => {
  it('A에서 원자재를 누르면 C-a 탭이 열리고 title-bar에 원자재명이 보인다', async () => {
    await renderApp();
    await fireEvent.press(await screen.findByText('원유 / CL'));

    expect(screen).toHavePathname('/commodity/CL');
    expect(screen.getByRole('header', { name: '원유 / CL' })).toBeOnTheScreen();
    expect(screen.getByTestId('disparity-chart-screen')).toBeOnTheScreen();
  });

  it('C 하단 탭으로 C-b~C-d를 오간다', async () => {
    await renderApp('/commodity/NG');

    await fireEvent.press(screen.getByText('월물커브'));
    expect(screen).toHavePathname('/commodity/NG/curve');
    await fireEvent.press(screen.getByText('월물차트'));
    expect(screen).toHavePathname('/commodity/NG/contracts');
    await fireEvent.press(screen.getByText('ETP'));
    expect(screen).toHavePathname('/commodity/NG/etps');
  });

  it('C [←]는 탭을 옮긴 뒤에도, 바로 들어온 경우에도 A로 간다', async () => {
    await renderApp('/commodity/NG/curve');
    await fireEvent.press(screen.getByText('월물차트'));
    await fireEvent.press(screen.getByLabelText('뒤로'));

    expect(screen).toHavePathname('/');
    expect(await screen.findByText('원유 / CL')).toBeOnTheScreen();
  });

  it('C [⚙]는 B로 가고, B에서 돌아오면 C다', async () => {
    await renderApp('/commodity/GC');
    await fireEvent.press(screen.getByLabelText('설정'));
    expect(screen).toHavePathname('/settings');

    await fireEvent.press(screen.getByLabelText('뒤로'));
    expect(screen).toHavePathname('/commodity/GC');
  });

  it('C-d-a는 탭 밖 스택이라 하단 탭이 없고, 뒤로 가면 C 탭이다', async () => {
    await renderApp('/commodity/SI/etp/123');
    expect(screen.getByTestId('etp-detail-screen')).toBeOnTheScreen();
    expect(screen.queryByText('월물커브')).not.toBeOnTheScreen();

    await fireEvent.press(screen.getByLabelText('뒤로'));
    expect(screen).toHavePathname('/commodity/SI');
  });

  it('B에서 B-a·B-b·데이터 출처로 간다', async () => {
    await renderApp('/settings');

    await fireEvent.press(screen.getByText('알림'));
    expect(screen).toHavePathname('/settings/alerts');
    await fireEvent.press(screen.getByLabelText('뒤로'));

    await fireEvent.press(screen.getByText('접근 키'));
    expect(screen).toHavePathname('/settings/access-key');
    await fireEvent.press(screen.getByLabelText('뒤로'));

    await fireEvent.press(screen.getByText('데이터 출처'));
    expect(screen).toHavePathname('/settings/data-sources');
  });
});

describe('가로 전환', () => {
  it.each([
    ['세로', { width: 390, height: 844 }, OrientationLock.LANDSCAPE],
    ['가로', { width: 844, height: 390 }, OrientationLock.PORTRAIT_UP],
  ])('%s에서 [⟲]를 누르면 반대 방향으로 잠근다', async (_, size, expected) => {
    Object.assign(mockWindow, size);
    await renderApp('/commodity/CL/curve');
    await fireEvent.press(screen.getByLabelText('가로/세로 전환'));

    expect(lockAsync).toHaveBeenLastCalledWith(expected);
  });

  it('ETP 탭에서는 [⟲]가 없고 세로로 돌아간다', async () => {
    await renderApp('/commodity/CL/contracts');
    expect(screen.getByLabelText('가로/세로 전환')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('ETP'));
    expect(screen.queryByLabelText('가로/세로 전환')).not.toBeOnTheScreen();
    expect(lockAsync).toHaveBeenLastCalledWith(OrientationLock.PORTRAIT_UP);
  });

  it.each([
    ['B', () => router.push('/settings')],
    ['ETP 상세', () => router.push('/commodity/CL/etp/1')],
    ['A', () => router.dismissTo('/')],
  ])('C를 떠나 %s로 가면 세로로 돌아간다', async (_, go) => {
    await renderApp('/commodity/CL');
    jest.mocked(lockAsync).mockClear();

    await act(() => go());
    expect(lockAsync).toHaveBeenLastCalledWith(OrientationLock.PORTRAIT_UP);
  });
});

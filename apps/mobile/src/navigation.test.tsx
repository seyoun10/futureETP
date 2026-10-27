import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useDisplaySettings } from '@/stores/displaySettings';

// Jest 기기 언어는 영어라 문구 확인을 위해 한국어로 고정한다.
beforeEach(() => {
  useDisplaySettings.getState().setLanguage('ko');
});

// 실제 src/app 라우트 트리로 화면 이동을 확인한다. 스파이크 화면은 Skia를 불러오므로 뺀다.
const renderApp = (initialUrl = '/') =>
  renderRouter({ appDir: 'src/app', overrides: { 'dev/chart-spike': () => null } }, { initialUrl });

describe('라우트 골격', () => {
  it('A에서 원자재를 누르면 C-a 탭이 열리고 title-bar에 원자재명이 보인다', async () => {
    await renderApp();
    await fireEvent.press(screen.getByText('원유 / CL'));

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
    expect(screen.getByText('원유 / CL')).toBeOnTheScreen();
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

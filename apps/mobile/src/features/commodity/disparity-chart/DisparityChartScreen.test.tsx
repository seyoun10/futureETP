import type { DisparityBar, DisparityChart, Settings } from '@futureetp/shared';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react-native';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { getDisparityChart } from '@/api/commodities';
import { queryClient } from '@/api/queryClient';
import { getSettings } from '@/api/settings';
import { CandleChart } from '@/charts/CandleChart';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn(), getDisparityChart: jest.fn() }));
jest.mock('@/api/settings', () => ({ getSettings: jest.fn(), patchSettings: jest.fn() }));
const mockGet = jest.mocked(getDisparityChart);
const mockChart = jest.mocked(CandleChart);

const SETTINGS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  basis: 'KR',
  maPeriod: 200,
  window: 'Y10',
  rareLevels: [1, 5, 10, 15, 25],
  alertCommodity: null,
  quietTime: null,
};

const bar = (
  tradeDate: string,
  close: number,
  extra: Partial<DisparityBar> = {},
): DisparityBar => ({
  tradeDate,
  open: close - 0.5,
  high: close + 1,
  low: close - 1,
  close,
  ma: 100,
  disparity: (close / 100 - 1) * 100,
  inRoll: false,
  holdings: [{ contractMonth: '2026-12', weight: 1 }],
  ...extra,
});

const DATA: DisparityChart = {
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: null,
  },
  priceDecimals: 1,
  basis: 'KR',
  fallback: false,
  maPeriod: 200,
  window: 'Y10',
  distribution: { actualStartDate: '2016-10-21', sampleCount: 2500 },
  rareLevels: [],
  currentTail: { side: 'DOWN', pct: 9.2 },
  provisional: true,
  bars: [
    bar('2026-10-20', 90),
    bar('2026-10-21', 80, {
      inRoll: true,
      holdings: [
        { contractMonth: '2026-12', weight: 0.6 },
        { contractMonth: '2027-02', weight: 0.4 },
      ],
    }),
    bar('2026-10-22', 85, { inRoll: true }),
  ],
};

type ChartProps = ComponentProps<typeof CandleChart>;
const lastChartProps = (): ChartProps => {
  const call = mockChart.mock.lastCall;
  if (!call) throw new Error('CandleChart was not rendered');
  return call[0];
};

beforeEach(() => {
  useDisplaySettings.setState({ language: 'ko', upDownStyle: 'KR', disparityPeriod: '12M' });
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockChart.mockClear();
  jest.mocked(getSettings).mockReset().mockResolvedValue(SETTINGS);
  mockGet.mockReset().mockResolvedValue(DATA);
});

const renderScreen = () =>
  renderRouter(
    { appDir: 'src/app', overrides: { 'dev/chart-spike': () => null } },
    { initialUrl: '/commodity/GC' },
  );

describe('C-a 이격도차트', () => {
  it('설정 값(기준값·이평선·윈도·rare 레벨)으로 조회한다', async () => {
    await renderScreen();
    await screen.findByTestId('disparity-stats');

    expect(mockGet).toHaveBeenCalledWith(
      'GC',
      { basis: 'KR', ma: 200, window: 'Y10', levels: [1, 5, 10, 15, 25] },
      expect.anything(),
    );
  });

  it('좌상단은 기준값(롤 중)과 오늘 시고저종, 좌하단은 이격도와 꼬리 백분위다', async () => {
    await renderScreen();

    expect(
      await screen.findByText('한국형 (롤 중) · 시84.5 고86.0 저84.0 종85.0', { exact: false }),
    ).toBeOnTheScreen();
    expect(screen.getByText(/기준 · 거래일 10\/22 · 지연 · 장중$/)).toBeOnTheScreen();
    expect(screen.getByTestId('disparity-stats')).toHaveTextContent('이격도 -15.0% (하위 9%)');
  });

  it('보이는 봉이 정해지면 저점대비·고점대비를 붙인다', async () => {
    await renderScreen();
    await screen.findByTestId('disparity-stats');

    await act(() => lastChartProps().onVisibleRangeChange?.(0, 2));

    // 최저가 79(10/21), 최고가 91(10/20), 현재가 85
    expect(screen.getByTestId('disparity-stats')).toHaveTextContent(
      '이격도 -15.0% (하위 9%) · 저점대비 +7.59% · 고점대비 -6.59%',
    );
  });

  it('대표월물로 대신 보여 주면 대표월물*과 지금 월물이고, 누르면 대체 안내가 열린다', async () => {
    mockGet.mockResolvedValue({ ...DATA, basis: 'FRONT', fallback: true });
    await renderScreen();

    await fireEvent.press(await screen.findByText('대표월물* DEC26'));

    expect(
      screen.getByText('이 원자재에는 한국형 상품이 없어 대표월물로 대신 보여 줍니다.'),
    ).toBeOnTheScreen();
  });

  it('기간은 기억한 12M으로 시작하고, 제스처 뒤에는 선택이 풀리며, 칩을 누르면 그 기간을 기억한다', async () => {
    await renderScreen();
    await screen.findByTestId('disparity-stats');

    expect(lastChartProps().periodBars).toBe(252);
    expect(screen.getByRole('radio', { name: '12M' })).toBeChecked();

    await act(() => lastChartProps().onGestureStart());
    expect(lastChartProps().periodBars).toBeNull();
    expect(screen.getByRole('radio', { name: '12M' })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: '3M' }));
    expect(lastChartProps().periodBars).toBe(63);
    expect(useDisplaySettings.getState().disparityPeriod).toBe('3M');
  });

  it('십자선 상세는 날짜·시고저종·전일 대비·이격도·월물 비중이다', async () => {
    await renderScreen();
    await screen.findByTestId('disparity-stats');

    const detail = lastChartProps().renderDetail(1);
    await render(<>{detail}</>);

    expect(screen.getByText('2026-10-21')).toBeOnTheScreen();
    expect(screen.getByText('시 79.5  고 81.0')).toBeOnTheScreen();
    expect(screen.getByText('저 79.0  종 80.0')).toBeOnTheScreen();
    expect(screen.getByText('전일 대비 -10.0 (-11.11%)')).toBeOnTheScreen();
    expect(screen.getByText('이격도 -20.0%')).toBeOnTheScreen();
    expect(screen.getByText('DEC26 60% · FEB27 40%')).toBeOnTheScreen();
  });

  it('설정을 못 읽으면 오류와 다시 시도를 보여 준다', async () => {
    jest.mocked(getSettings).mockRejectedValue(new Error('down'));
    await renderScreen();

    expect(await screen.findByText('다시 시도')).toBeOnTheScreen();
    expect(mockGet).not.toHaveBeenCalled();
  });
});

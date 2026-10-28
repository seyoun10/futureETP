import type { ContractsChart } from '@futureetp/shared';
import type { ComponentProps } from 'react';
import { act, render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { getContracts } from '@/api/commodities';
import { queryClient } from '@/api/queryClient';
import { LinesChart } from '@/charts/LinesChart';
import { useDisplaySettings } from '@/stores/displaySettings';
import { colors } from '@/theme/tokens';

jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn(), getContracts: jest.fn() }));
const mockGet = jest.mocked(getContracts);
const mockChart = jest.mocked(LinesChart);

const DATA: ContractsChart = {
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: null,
  },
  priceDecimals: 3,
  dates: ['2026-10-20', '2026-10-21', '2026-10-22'],
  provisional: true,
  contracts: [
    { symbol: 'NGZ26', contractMonth: '2026-12', prices: [3.1, 3.2, 3.3] },
    { symbol: 'NGF27', contractMonth: '2027-01', prices: [null, 3.5, 3.45] },
  ],
};

type ChartProps = ComponentProps<typeof LinesChart>;
const lastChartProps = (): ChartProps => {
  const call = mockChart.mock.lastCall;
  if (!call) throw new Error('LinesChart was not rendered');
  return call[0];
};

beforeEach(() => {
  useDisplaySettings.setState({
    language: 'ko',
    upDownStyle: 'KR',
    disparityPeriod: '3M',
    contractPeriod: '12M',
  });
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockChart.mockClear();
  mockGet.mockReset().mockResolvedValue(DATA);
});

const renderScreen = async () => {
  await renderRouter('src/app', { initialUrl: '/commodity/NG/contracts' });
  await screen.findByRole('radio', { name: '12M' });
};

describe('C-c 월물차트', () => {
  it('월물마다 선 하나와 끝값 라벨(월물명)을 넘긴다', async () => {
    await renderScreen();

    expect(mockGet).toHaveBeenCalledWith('NG', expect.anything());
    const props = lastChartProps();
    expect(props.dates).toEqual(DATA.dates);
    expect(props.lines.map((l) => l.values)).toEqual([
      [3.1, 3.2, 3.3],
      [null, 3.5, 3.45],
    ]);
    expect(props.endLabels.map((l) => [l.price, l.suffix, l.color])).toEqual([
      [3.3, 'DEC26', colors.chart.contractLines[0]],
      [3.45, 'JAN27', colors.chart.contractLines[1]],
    ]);
  });

  it('기간은 C-a와 따로 기억한다: 12M으로 시작하고, 제스처 뒤 선택이 풀리며, 칩을 누르면 기억한다', async () => {
    await renderScreen();

    expect(lastChartProps().periodBars).toBe(252);
    expect(screen.getByRole('radio', { name: '12M' })).toBeChecked();

    await act(() => lastChartProps().onGestureStart());
    expect(lastChartProps().periodBars).toBeNull();
    expect(screen.getByRole('radio', { name: '12M' })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: '6M' }));
    expect(lastChartProps().periodBars).toBe(126);
    expect(useDisplaySettings.getState()).toMatchObject({
      contractPeriod: '6M',
      disparityPeriod: '3M',
    });
  });

  it('십자선 상세는 날짜와 그날 값이 있는 월물 가격이고, 오늘 잠정 값은 표시한다', async () => {
    await renderScreen();

    await render(<>{lastChartProps().renderDetail(0)}</>);
    expect(screen.getByText('2026-10-20')).toBeOnTheScreen();
    expect(screen.getByText('DEC26 3.100')).toBeOnTheScreen();
    expect(screen.queryByText(/^JAN27/)).toBeNull();

    await render(<>{lastChartProps().renderDetail(2)}</>);
    expect(screen.getByText('2026-10-22 (잠정)')).toBeOnTheScreen();
    expect(screen.getByText('JAN27 3.450')).toBeOnTheScreen();
  });

  it('월물이 없으면 안내 문구를 보여 준다', async () => {
    mockGet.mockResolvedValue({ ...DATA, dates: [], contracts: [] });
    await renderRouter('src/app', { initialUrl: '/commodity/NG/contracts' });

    expect(await screen.findByText('표시할 월물이 없습니다.')).toBeOnTheScreen();
  });
});

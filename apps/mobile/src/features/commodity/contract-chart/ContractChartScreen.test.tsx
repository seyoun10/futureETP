import type { ContractsChart } from '@futureetp/shared';
import type { ComponentProps } from 'react';
import { act, render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { getCommodities, getContracts } from '@/api/commodities';
import { queryClient } from '@/api/queryClient';
import { LinesChart } from '@/charts/LinesChart';
import { useDisplaySettings } from '@/stores/displaySettings';
import { colors } from '@/theme/tokens';

import { EMPTY_COMMODITIES } from '../commodities.fixtures';
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
  hasMore: false,
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
  jest.mocked(getCommodities).mockResolvedValue(EMPTY_COMMODITIES);
  useDisplaySettings.setState({ language: 'ko', upDownStyle: 'KR' });
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockChart.mockClear();
  mockGet.mockReset().mockResolvedValue(DATA);
});

const renderScreen = async () => {
  await renderRouter('src/app', { initialUrl: '/commodity/NG/contracts' });
  await screen.findByRole('radio', { name: '6M' });
};

describe('C-c 월물차트', () => {
  it('월물마다 선 하나와 끝값 라벨(월물명)을 넘긴다', async () => {
    await renderScreen();

    expect(mockGet).toHaveBeenCalledWith('NG', undefined, expect.anything());
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

  it('보이는 범위가 바뀌면 끝값 라벨이 그 범위 마지막 날 값으로 바뀐다', async () => {
    await renderScreen();

    await act(() => lastChartProps().onVisibleRangeChange(0, 1));
    expect(lastChartProps().endLabels.map((l) => [l.price, l.suffix])).toEqual([
      [3.2, 'DEC26'],
      [3.5, 'JAN27'],
    ]);
  });

  it('기간은 6M으로 시작하고, 드래그 뒤에는 선택이 남고 핀치 뒤에는 풀리며, 칩을 누르면 그 기간으로 맞춘다', async () => {
    await renderScreen();

    expect(lastChartProps().periodBars).toBe(126);
    expect(screen.getByRole('radio', { name: '6M' })).toBeChecked();

    // 드래그는 기간 맞춤만 멈추고 선택 표시는 남긴다
    await act(() => lastChartProps().onViewChange('pan'));
    expect(lastChartProps().periodBars).toBeNull();
    expect(screen.getByRole('radio', { name: '6M' })).toBeChecked();

    // 핀치하면 선택 표시가 풀리고, 이어서 드래그해도 돌아오지 않는다
    await act(() => lastChartProps().onViewChange('zoom'));
    await act(() => lastChartProps().onViewChange('pan'));
    expect(lastChartProps().periodBars).toBeNull();
    expect(screen.getByRole('radio', { name: '6M' })).not.toBeChecked();

    await fireEvent.press(screen.getByRole('radio', { name: '12M' }));
    expect(lastChartProps().periodBars).toBe(252);
  });

  it('드래그·핀치 뒤에만 [↻]이 보이고, 누르면 선택한 기간의 최근 위치로 돌아간다', async () => {
    await renderScreen();
    await screen.findByRole('radio', { name: '6M' });
    expect(screen.queryByRole('button', { name: '선택한 기간의 최근 위치로' })).toBeNull();

    await act(() => lastChartProps().onViewChange('zoom'));
    expect(lastChartProps().periodBars).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: '선택한 기간의 최근 위치로' }));
    expect(lastChartProps().periodBars).toBe(126);
    expect(screen.getByRole('radio', { name: '6M' })).toBeChecked();
    expect(screen.queryByRole('button', { name: '선택한 기간의 최근 위치로' })).toBeNull();
  });

  it('드래그로 벗어났다가 기간의 최근 위치로 돌아오면 [↻]이 사라진다', async () => {
    await renderScreen();
    await screen.findByRole('radio', { name: '6M' });

    await act(() => lastChartProps().onViewChange('pan'));
    expect(screen.getByRole('button', { name: '선택한 기간의 최근 위치로' })).toBeOnTheScreen();

    await act(() => lastChartProps().onViewChange(null));
    expect(lastChartProps().periodBars).toBe(126);
    expect(screen.getByRole('radio', { name: '6M' })).toBeChecked();
    expect(screen.queryByRole('button', { name: '선택한 기간의 최근 위치로' })).toBeNull();
  });

  it('십자선 상세는 날짜와 그날 값이 있는 월물 가격·양끝 차이이고, 오늘 잠정 값은 표시한다', async () => {
    await renderScreen();

    await render(<>{lastChartProps().renderDetail(0)}</>);
    expect(screen.getByText('2026-10-20')).toBeOnTheScreen();
    expect(screen.getByText('DEC26')).toBeOnTheScreen();
    expect(screen.getByText('3.100')).toBeOnTheScreen();
    expect(screen.queryByText('JAN27')).toBeNull();
    // 값이 있는 월물이 하나면 양끝 차이를 쓰지 않는다
    expect(screen.queryByText('양끝 차이')).toBeNull();

    await render(<>{lastChartProps().renderDetail(2)}</>);
    expect(screen.getByText('2026-10-22')).toBeOnTheScreen();
    expect(screen.getByText('(잠정)')).toBeOnTheScreen();
    expect(screen.getByText('JAN27')).toBeOnTheScreen();
    expect(screen.getByText('3.450')).toBeOnTheScreen();
    // 양끝 차이: 3.45 / 3.3 - 1
    expect(screen.getByText('양끝 차이')).toBeOnTheScreen();
    expect(screen.getByText('+4.55%')).toBeOnTheScreen();
  });

  it('월물이 없으면 안내 문구를 보여 준다', async () => {
    mockGet.mockResolvedValue({ ...DATA, dates: [], contracts: [] });
    await renderRouter('src/app', { initialUrl: '/commodity/NG/contracts' });

    expect(await screen.findByText('표시할 월물이 없습니다.')).toBeOnTheScreen();
  });
});

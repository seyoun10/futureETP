import type { Curve } from '@futureetp/shared';
import type { ComponentProps } from 'react';
import { render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { getCurve } from '@/api/commodities';
import { queryClient } from '@/api/queryClient';
import { CurveChart } from '@/charts/CurveChart';
import { useDisplaySettings } from '@/stores/displaySettings';

jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn(), getCurve: jest.fn() }));
const mockGet = jest.mocked(getCurve);
const mockChart = jest.mocked(CurveChart);

const STATS = {
  m1ContractMonth: '2026-12',
  m2ContractMonth: '2027-01',
  state: 'CONTANGO',
  spreadPct: 9,
  rollYieldPct: -89,
} as const;

// D = 10/22, 기준일 기본값 D-1 = 10/21
const DATA: Curve = {
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: null,
  },
  priceDecimals: 3,
  baseDate: '2026-10-21',
  baseOffset: 1,
  prevBaseDate: '2026-10-20',
  nextBaseDate: null,
  minBaseDate: '2010-06-07',
  maxBaseDate: '2026-10-21',
  points: [
    {
      symbol: 'NGX26',
      contractMonth: '2026-11',
      basePrice: 3.1,
      currentPrice: null,
      changePct: null,
    },
    {
      symbol: 'NGZ26',
      contractMonth: '2026-12',
      basePrice: 3.2,
      currentPrice: 3.168,
      changePct: -1,
    },
    {
      symbol: 'NGF27',
      contractMonth: '2027-01',
      basePrice: null,
      currentPrice: 3.45,
      changePct: null,
    },
  ],
  current: STATS,
  base: { ...STATS, rollYieldPct: -86.66 },
};

type ChartProps = ComponentProps<typeof CurveChart>;
const lastChartProps = (): ChartProps => {
  const call = mockChart.mock.lastCall;
  if (!call) throw new Error('CurveChart was not rendered');
  return call[0];
};

beforeEach(() => {
  useDisplaySettings.setState({ language: 'ko', upDownStyle: 'KR' });
  useAccessKeyStore.setState({ key: 'key', rejected: false });
  queryClient.clear();
  mockChart.mockClear();
  mockGet.mockReset().mockResolvedValue(DATA);
});

const renderScreen = () => renderRouter('src/app', { initialUrl: '/commodity/NG/curve' });

describe('C-b 월물커브', () => {
  it('기준일 없이 조회하고 범례·기준일·수치 요약을 보여 준다', async () => {
    await renderScreen();

    expect(await screen.findByTestId('curve-base-date')).toHaveTextContent('2026/10/21 (D-1)');
    expect(mockGet).toHaveBeenCalledWith('NG', null, expect.anything());
    expect(screen.getByTestId('curve-legend')).toHaveTextContent(
      '╌╌ 기준일 10/21 종가 ── 현재 10/22',
    );
    expect(screen.getByTestId('curve-state')).toHaveTextContent(
      '콘탱고 (M1→M2) · DEC26→JAN27 +9.0%',
    );
    expect(screen.getByTestId('curve-roll-yield')).toHaveTextContent(
      '롤 수익률 -89.0%/년 (기준일 -86.7%/년)',
    );
    expect(lastChartProps().points).toEqual([
      { label: 'NOV26', base: 3.1, current: null, changePct: null },
      { label: 'DEC26', base: 3.2, current: 3.168, changePct: -1 },
      { label: 'JAN27', base: null, current: 3.45, changePct: null },
    ]);
  });

  it('D-1에서는 + 와 0이 비활성이고, - 는 앞 거래일로 다시 조회한다', async () => {
    await renderScreen();
    await screen.findByTestId('curve-base-date');

    expect(screen.getByRole('button', { name: '기준일을 1 거래일 뒤로' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '기준일을 D-1로' })).toBeDisabled();

    mockGet.mockResolvedValue({
      ...DATA,
      baseDate: '2026-10-20',
      baseOffset: 2,
      prevBaseDate: '2026-10-19',
      nextBaseDate: '2026-10-21',
    });
    await fireEvent.press(screen.getByRole('button', { name: '기준일을 1 거래일 앞으로' }));

    expect(mockGet).toHaveBeenLastCalledWith('NG', '2026-10-20', expect.anything());
    expect(await screen.findByText('2026/10/20 (D-2)')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: '기준일을 D-1로' })).toBeEnabled();
  });

  it('+ 로 D-1에 오거나 0을 누르면 기본값(null) 조회 key로 돌아간다', async () => {
    const D2 = {
      ...DATA,
      baseDate: '2026-10-20',
      baseOffset: 2,
      prevBaseDate: '2026-10-19',
      nextBaseDate: '2026-10-21',
    };
    mockGet.mockImplementation((_, baseDate) => Promise.resolve(baseDate === null ? DATA : D2));
    await renderScreen();
    await screen.findByTestId('curve-base-date');

    for (const name of ['기준일을 1 거래일 뒤로', '기준일을 D-1로']) {
      await fireEvent.press(screen.getByRole('button', { name: '기준일을 1 거래일 앞으로' }));
      expect(await screen.findByText('2026/10/20 (D-2)')).toBeOnTheScreen();

      await fireEvent.press(screen.getByRole('button', { name }));
      expect(await screen.findByText('2026/10/21 (D-1)')).toBeOnTheScreen();
    }
    // D-1을 날짜로 따로 조회하지 않는다
    expect(new Set(mockGet.mock.calls.map((c) => c[1]))).toEqual(new Set([null, '2026-10-20']));
  });

  it('하한에서는 - 가 비활성이고, 올해가 아닌 기준일은 범례에 연도를 붙인다', async () => {
    mockGet.mockResolvedValue({
      ...DATA,
      baseDate: '2010-06-07',
      baseOffset: 4100,
      prevBaseDate: null,
      nextBaseDate: '2010-06-08',
    });
    await renderScreen();

    expect(await screen.findByTestId('curve-legend')).toHaveTextContent(/기준일 2010\/06\/07 종가/);
    expect(screen.getByRole('button', { name: '기준일을 1 거래일 앞으로' })).toBeDisabled();
  });

  it('현재 커브가 없으면 수치 요약은 산출 불가다', async () => {
    mockGet.mockResolvedValue({ ...DATA, current: null, base: null });
    await renderScreen();

    expect(await screen.findByTestId('curve-state')).toHaveTextContent('커브 상태 산출 불가');
    expect(screen.getByTestId('curve-roll-yield')).toHaveTextContent(
      '롤 수익률 산출 불가 (기준일 산출 불가)',
    );
  });

  it('툴팁은 월물·기준일·현재·변화율이고 없는 값은 뺀다', async () => {
    await renderScreen();
    await screen.findByTestId('curve-base-date');

    await render(<>{lastChartProps().renderDetail(1)}</>);
    expect(screen.getByText('DEC26')).toBeOnTheScreen();
    expect(screen.getByText('기준일 3.200')).toBeOnTheScreen();
    expect(screen.getByText('현재 3.168')).toBeOnTheScreen();
    expect(screen.getByText('변화율 -1.0%')).toBeOnTheScreen();

    await render(<>{lastChartProps().renderDetail(2)}</>);
    expect(screen.getByText('현재 3.450')).toBeOnTheScreen();
    expect(screen.queryByText(/^기준일 /)).toBeNull();
  });

  it('월물이 없으면 안내 문구를 보여 준다', async () => {
    mockGet.mockResolvedValue({ ...DATA, points: [] });
    await renderScreen();

    expect(await screen.findByText('표시할 월물이 없습니다.')).toBeOnTheScreen();
  });
});

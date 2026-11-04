import type { Curve } from '@futureetp/shared';
import type { ComponentProps } from 'react';
import { act, render } from '@testing-library/react-native';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { useAccessKeyStore } from '@/api/accessToken';
import { getCommodities, getCurve } from '@/api/commodities';
import { queryClient } from '@/api/queryClient';
import { CurveChart } from '@/charts/CurveChart';
import { useDisplaySettings } from '@/stores/displaySettings';

import { EMPTY_COMMODITIES } from '../commodities.fixtures';
jest.mock('@/api/commodities', () => ({ getCommodities: jest.fn(), getCurve: jest.fn() }));
// OS 날짜 피커는 네이티브라 props를 받는 View로 둔다(jest-expo는 iOS라 시트 경로를 탄다)
jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: jest.requireActual<typeof import('react-native')>('react-native').View,
  DateTimePickerAndroid: { open: jest.fn() },
}));
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
  compareDate: '2026-10-22',
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
  jest.mocked(getCommodities).mockResolvedValue(EMPTY_COMMODITIES);
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

    expect(await screen.findByTestId('curve-base-date')).toHaveTextContent('2026/10/21');
    expect(mockGet).toHaveBeenCalledWith('NG', null, expect.anything());
    expect(screen.getByTestId('curve-legend')).toHaveTextContent('╌╌ 10/21 ── 10/22');
    expect(screen.getByTestId('curve-state')).toHaveTextContent(
      '콘탱고 (M1→M2) · DEC26→JAN27 +9.0%',
    );
    expect(screen.getByTestId('curve-roll-yield')).toHaveTextContent(
      '롤 수익률 -89.0%/년 (-86.7%/년)',
    );
    expect(lastChartProps().points).toEqual([
      { label: '2611', base: 3.1, current: null, changePct: null },
      { label: '2612', base: 3.2, current: 3.168, changePct: -1 },
      { label: '2701', base: null, current: 3.45, changePct: null },
    ]);
  });

  it('D-1에서는 + 가 비활성이고 되돌리기 버튼이 없으며, - 는 앞 거래일로 다시 조회한다', async () => {
    await renderScreen();
    await screen.findByTestId('curve-base-date');

    expect(screen.getByRole('button', { name: '기준일을 1 거래일 뒤로' })).toBeDisabled();
    expect(lastChartProps().onResetView).toBeUndefined();

    mockGet.mockResolvedValue({
      ...DATA,
      baseDate: '2026-10-20',
      baseOffset: 2,
      prevBaseDate: '2026-10-19',
      nextBaseDate: '2026-10-21',
      compareDate: '2026-10-21',
    });
    await fireEvent.press(screen.getByRole('button', { name: '기준일을 1 거래일 앞으로' }));

    expect(mockGet).toHaveBeenLastCalledWith('NG', '2026-10-20', expect.anything());
    expect(await screen.findByText('2026/10/20')).toBeOnTheScreen();
    // 비교 커브는 기준일 다음 거래일 종가다(D-114)
    expect(screen.getByTestId('curve-legend')).toHaveTextContent('╌╌ 10/20 ── 10/21');
    expect(lastChartProps().onResetView).toBeDefined();
    expect(lastChartProps().resetLabel).toBe('기준일을 최근 거래일로');
  });

  it('+ 로 D-1에 오거나 되돌리기를 누르면 기본값(null) 조회 key로 돌아간다', async () => {
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

    const back = [
      () => fireEvent.press(screen.getByRole('button', { name: '기준일을 1 거래일 뒤로' })),
      () => act(() => lastChartProps().onResetView?.()),
    ];
    for (const press of back) {
      await fireEvent.press(screen.getByRole('button', { name: '기준일을 1 거래일 앞으로' }));
      expect(await screen.findByText('2026/10/20')).toBeOnTheScreen();

      await press();
      expect(await screen.findByText('2026/10/21')).toBeOnTheScreen();
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
      compareDate: '2010-06-08',
    });
    await renderScreen();

    expect(await screen.findByTestId('curve-legend')).toHaveTextContent(
      '╌╌ 2010/06/07 ── 2010/06/08',
    );
    expect(screen.getByRole('button', { name: '기준일을 1 거래일 앞으로' })).toBeDisabled();
  });

  it('현재 커브가 없으면 수치 요약은 산출 불가다', async () => {
    mockGet.mockResolvedValue({ ...DATA, current: null, base: null });
    await renderScreen();

    expect(await screen.findByTestId('curve-state')).toHaveTextContent('커브 상태 산출 불가');
    expect(screen.getByTestId('curve-roll-yield')).toHaveTextContent(
      '롤 수익률 산출 불가 (산출 불가)',
    );
  });

  it('툴팁은 월물·기준일 값·비교일 값·변화율이고 항목은 날짜이며 없는 값은 뺀다', async () => {
    await renderScreen();
    await screen.findByTestId('curve-base-date');

    await render(<>{lastChartProps().renderDetail(1)}</>);
    expect(screen.getByText('DEC26')).toBeOnTheScreen();
    expect(screen.getByText('10/21')).toBeOnTheScreen();
    expect(screen.getByText('3.200')).toBeOnTheScreen();
    expect(screen.getByText('10/22')).toBeOnTheScreen();
    expect(screen.getByText('3.168')).toBeOnTheScreen();
    expect(screen.getByText('변화율')).toBeOnTheScreen();
    expect(screen.getByText('-1.0%')).toBeOnTheScreen();

    await render(<>{lastChartProps().renderDetail(2)}</>);
    expect(screen.getByText('3.450')).toBeOnTheScreen();
    expect(screen.queryByText('10/21')).toBeNull();
  });

  it('올해가 아닌 날짜 항목은 연도를 붙인다', async () => {
    mockGet.mockResolvedValue({ ...DATA, baseDate: '2024-03-14', compareDate: '2024-03-15' });
    await renderScreen();
    await screen.findByTestId('curve-base-date');

    await render(<>{lastChartProps().renderDetail(1)}</>);
    expect(screen.getByText('2024/03/14')).toBeOnTheScreen();
    expect(screen.getByText('2024/03/15')).toBeOnTheScreen();
  });

  it('월물이 없으면 안내 문구를 보여 준다', async () => {
    mockGet.mockResolvedValue({ ...DATA, points: [] });
    await renderScreen();

    expect(await screen.findByText('표시할 월물이 없습니다.')).toBeOnTheScreen();
  });

  describe('기준일 선택 시트', () => {
    const D2 = {
      ...DATA,
      baseDate: '2026-10-20',
      baseOffset: 2,
      prevBaseDate: '2026-10-19',
      nextBaseDate: '2026-10-21',
    };
    // 10/16(금)은 휴장이라 서버가 10/15(목)로 옮긴다
    const D5 = {
      ...DATA,
      baseDate: '2026-10-15',
      baseOffset: 5,
      prevBaseDate: '2026-10-14',
      nextBaseDate: '2026-10-19',
    };
    beforeEach(() => {
      mockGet.mockImplementation((_, baseDate) =>
        Promise.resolve(baseDate === null ? DATA : baseDate === '2026-10-20' ? D2 : D5),
      );
    });

    const openSheet = async () => {
      await fireEvent.press(await screen.findByRole('button', { name: '2026/10/21' }));
      return screen.getByTestId('base-date-picker');
    };
    const pick = (picker: ReturnType<typeof screen.getByTestId>, y: number, m: number, d: number) =>
      fireEvent(picker, 'valueChange', { nativeEvent: {} }, new Date(y, m - 1, d));

    it('현재 기준일·범위로 열고, 휴장일을 확인하면 옮긴 날짜를 잠깐 안내한다', async () => {
      jest.useFakeTimers();
      try {
        await renderScreen();
        const picker = await openSheet();

        expect(screen.getByText('기준일 선택')).toBeOnTheScreen();
        expect(screen.getByText('선택 가능: 2010/06/07 ~ 2026/10/21')).toBeOnTheScreen();
        expect(picker.props).toMatchObject({
          value: new Date(2026, 9, 21),
          minimumDate: new Date(2010, 5, 7),
          maximumDate: new Date(2026, 9, 21),
        });

        await pick(picker, 2026, 10, 16);
        await fireEvent.press(screen.getByRole('button', { name: '확인' }));

        expect(mockGet).toHaveBeenLastCalledWith('NG', '2026-10-16', expect.anything());
        expect(await screen.findByTestId('curve-moved')).toHaveTextContent(
          '휴장일이라 10/15(목)로 옮겼습니다',
        );
        expect(screen.getByTestId('curve-base-date')).toHaveTextContent('2026/10/15');
        expect(screen.queryByText('기준일 선택')).toBeNull();

        await act(() => jest.advanceTimersByTime(3000));
        expect(screen.queryByTestId('curve-moved')).toBeNull();
      } finally {
        jest.useRealTimers();
      }
    });

    it('취소하거나 시트 밖을 누르면 기준일을 바꾸지 않는다', async () => {
      await renderScreen();

      await pick(await openSheet(), 2026, 10, 20);
      await fireEvent.press(screen.getByRole('button', { name: '취소' }));
      expect(screen.queryByText('기준일 선택')).toBeNull();

      await pick(await openSheet(), 2026, 10, 20);
      await fireEvent.press(screen.getByTestId('base-date-backdrop'));
      expect(screen.queryByText('기준일 선택')).toBeNull();

      expect(mockGet.mock.calls.map((c) => c[1])).toEqual([null]);
      expect(screen.getByTestId('curve-base-date')).toHaveTextContent('2026/10/21');
    });

    it('거래일을 고르면 안내 없이 옮기고, D-1을 고르면 기본값 key로 돌아간다', async () => {
      await renderScreen();

      await pick(await openSheet(), 2026, 10, 20);
      await fireEvent.press(screen.getByRole('button', { name: '확인' }));
      expect(await screen.findByText('2026/10/20')).toBeOnTheScreen();
      expect(screen.queryByTestId('curve-moved')).toBeNull();

      await fireEvent.press(screen.getByRole('button', { name: '2026/10/20' }));
      await pick(screen.getByTestId('base-date-picker'), 2026, 10, 21);
      await fireEvent.press(screen.getByRole('button', { name: '확인' }));
      expect(await screen.findByText('2026/10/21')).toBeOnTheScreen();
      expect(new Set(mockGet.mock.calls.map((c) => c[1]))).toEqual(new Set([null, '2026-10-20']));
    });
  });
});

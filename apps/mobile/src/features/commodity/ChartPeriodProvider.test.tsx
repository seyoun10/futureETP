import { router, Slot } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Pressable, Text } from 'react-native';
import { useChartPeriod } from './ChartPeriodProvider';
import { CommodityLayout } from './CommodityLayout';

// 차트 대신 기간만 보여 주고 바꾸는 화면
function PeriodScreen({ chart }: { chart: 'disparity' | 'contract' }) {
  const [period, setPeriod] = useChartPeriod(chart);
  return (
    <Pressable onPress={() => setPeriod('12M')}>
      <Text>{`${chart} ${period}`}</Text>
    </Pressable>
  );
}

// 목록 → 원자재 스택(C-a·C-c)과 같은 구조
const renderApp = () =>
  renderRouter(
    {
      _layout: () => <Slot />,
      index: () => <Text>list</Text>,
      'commodity/[code]/_layout': CommodityLayout,
      'commodity/[code]/index': () => <PeriodScreen chart="disparity" />,
      'commodity/[code]/contracts': () => <PeriodScreen chart="contract" />,
    },
    { initialUrl: '/' },
  );

describe('ChartPeriodProvider', () => {
  it('C-a·C-c 기간은 6M으로 시작해 따로 고르고, 탭을 오가도 유지하며, 목록으로 나갔다 오면 6M이다', async () => {
    await renderApp();
    await act(() => router.push('/commodity/GC'));
    expect(screen.getByText('disparity 6M')).toBeOnTheScreen();

    await fireEvent.press(screen.getByText('disparity 6M'));
    await act(() => router.navigate('/commodity/GC/contracts'));
    expect(screen.getByText('contract 6M')).toBeOnTheScreen();
    await act(() => router.navigate('/commodity/GC'));
    expect(screen.getByText('disparity 12M')).toBeOnTheScreen();

    await act(() => router.navigate('/'));
    expect(screen.getByText('list')).toBeOnTheScreen();
    await act(() => router.push('/commodity/GC'));
    expect(screen.getByText('disparity 6M')).toBeOnTheScreen();
  });
});

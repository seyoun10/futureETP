import { useCallback, useState } from 'react';
import { nearestPeriod, PERIOD_BARS } from '@/charts/chartPeriods';
import type { ChartPeriod } from '@/charts/chartPeriods';
import type { ChartGesture } from '@/charts/useChartViewport';
import { useChartPeriod } from './ChartPeriodProvider';
import type { ChartKind } from './ChartPeriodProvider';

// C-a·C-c의 기간 선택과 제스처 상태(screens.md C-a 기간과 제스처, D-107).
// chartProps는 CandleChart·LinesChart에, chipProps는 PeriodChips에 그대로 넘긴다
export function useChartPeriodView(chart: ChartKind, barCount: number) {
  const [period, setPeriod] = useChartPeriod(chart);
  // 제스처로 범위를 바꾸면 기간 맞춤을 멈춘다. 선택 표시는 핀치(확대·축소)일 때만 지운다.
  // 고른 기간은 그대로 둔다
  const [gesture, setGesture] = useState<ChartGesture | null>(null);
  const [range, setRange] = useState<[number, number] | null>(null);

  const onSelect = (next: ChartPeriod) => {
    setPeriod(next);
    setGesture(null);
  };
  // 한 번 핀치하면 이후 드래그해도 선택 표시를 되살리지 않는다. 기간 범위로 돌아오면(null) 처음 상태다
  const onViewChange = useCallback(
    (next: ChartGesture | null) =>
      setGesture((prev) => (next !== null && prev === 'zoom' ? prev : next)),
    [],
  );
  const onVisibleRangeChange = useCallback((i0: number, i1: number) => setRange([i0, i1]), []);

  return {
    range,
    chartProps: {
      periodBars: gesture ? null : PERIOD_BARS[period],
      onViewChange,
      onVisibleRangeChange,
      onResetView: gesture ? () => setGesture(null) : undefined,
    },
    chipProps: {
      selected: gesture === 'zoom' ? null : period,
      nearest:
        gesture === 'zoom' && range ? nearestPeriod(range[1] - range[0] + 1, barCount) : null,
      onSelect,
    },
  };
}

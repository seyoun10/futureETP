import { Group, Rect, Skia } from '@shopify/react-native-skia';
import type { ChartBounds } from 'victory-native';

import { colors } from '@/theme/tokens';
import { useClampedTransform } from './useClampedTransform';

// 롤 표시(screens.md C-a 롤 표시). 한국형·미국형의 롤 기간 음영, [시작, 끝] 봉 순번 구간이다
export type RollMarks = {
  shading: readonly [number, number][];
};

type RollLayerProps = RollMarks & {
  // 봉 수
  count: number;
  chartBounds: ChartBounds;
  // 변환 전 첫 봉의 x와 봉 간격
  x0: number;
  dx: number;
};

export function RollLayer({ shading, count, chartBounds, x0, dx }: RollLayerProps) {
  const { k, tx } = useClampedTransform(count, chartBounds);
  if (dx <= 0) return null;
  const toScreen = (i: number) => k * (x0 + i * dx) + tx;
  const half = (k * dx) / 2;

  return (
    <Group
      clip={Skia.XYWHRect(
        chartBounds.left,
        chartBounds.top,
        chartBounds.right - chartBounds.left,
        chartBounds.bottom - chartBounds.top,
      )}
    >
      {shading.map(([start, end]) => {
        const left = toScreen(start) - half;
        const right = toScreen(end) + half;
        if (right < chartBounds.left || left > chartBounds.right) return null;
        return (
          <Rect
            key={`s${start}`}
            x={left}
            y={chartBounds.top}
            width={right - left}
            height={chartBounds.bottom - chartBounds.top}
            color={colors.chart.rollShade}
          />
        );
      })}
    </Group>
  );
}

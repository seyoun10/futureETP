import { Group, Paragraph, Path, Rect, Skia } from '@shopify/react-native-skia';
import { useCartesianTransformContext } from 'victory-native';
import type { ChartBounds } from 'victory-native';

import { colors } from '@/theme/tokens';
import { chartParagraph } from './chartText';

// 롤 표시(screens.md C-a 롤 표시). 음영은 [시작, 끝] 봉 순번 구간, 마커는 x축 위 ▲와 새 월물명이다
export type RollMarks = {
  shading: readonly [number, number][];
  markers: readonly { index: number; label: string }[];
};

type RollLayerProps = RollMarks & {
  chartBounds: ChartBounds;
  // 변환 전 첫 봉의 x와 봉 간격
  x0: number;
  dx: number;
};

const MARKER_SIZE = 5;

export function RollLayer({ shading, markers, chartBounds, x0, dx }: RollLayerProps) {
  const { k, tx } = useCartesianTransformContext();
  if (dx <= 0) return null;
  const toScreen = (i: number) => k * (x0 + i * dx) + tx;
  const half = (k * dx) / 2;
  const visible = (x: number) => x >= chartBounds.left - half && x <= chartBounds.right + half;

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
      {markers.map(({ index, label }) => {
        const x = toScreen(index);
        if (!visible(x)) return null;
        const y = chartBounds.bottom - 2;
        const triangle = Skia.PathBuilder.Make()
          .moveTo(x, y - MARKER_SIZE)
          .lineTo(x - MARKER_SIZE, y)
          .lineTo(x + MARKER_SIZE, y)
          .close()
          .detach();
        const paragraph = chartParagraph(label, colors.chart.rollMarker);
        return (
          <Group key={`m${index}`}>
            <Path path={triangle} color={colors.chart.rollMarker} />
            <Paragraph
              paragraph={paragraph}
              x={x + MARKER_SIZE + 2}
              y={y - paragraph.getHeight()}
              width={paragraph.getLongestLine() + 4}
            />
          </Group>
        );
      })}
    </Group>
  );
}

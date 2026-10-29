import { Group, Paragraph, Path, Rect, Skia } from '@shopify/react-native-skia';
import type { SkParagraph } from '@shopify/react-native-skia';
import type { ChartBounds } from 'victory-native';

import { colors } from '@/theme/tokens';
import { chartParagraph } from './chartText';
import { useClampedTransform } from './useClampedTransform';

// 롤 표시(screens.md C-a 롤 표시). 음영은 [시작, 끝] 봉 순번 구간, 마커는 x축 위 ▲와 짧은 라벨(새 월물의 월 번호)이다
export type RollMarks = {
  shading: readonly [number, number][];
  markers: readonly { index: number; label: string }[];
};

type RollLayerProps = RollMarks & {
  // 봉 수
  count: number;
  chartBounds: ChartBounds;
  // 변환 전 첫 봉의 x와 봉 간격
  x0: number;
  dx: number;
};

const MARKER_SIZE = 5;
const LABEL_GAP = 4;

export function RollLayer({ shading, markers, count, chartBounds, x0, dx }: RollLayerProps) {
  const { k, tx } = useClampedTransform(count, chartBounds);
  if (dx <= 0) return null;
  const toScreen = (i: number) => k * (x0 + i * dx) + tx;
  const half = (k * dx) / 2;
  const visible = (x: number) => x >= chartBounds.left - half && x <= chartBounds.right + half;
  // 마커는 봉 순번 오름차순이다. 축소해서 앞 라벨과 겹치면 라벨만 빼고 ▲는 남긴다
  const shown: { index: number; x: number; paragraph: SkParagraph; labelX: number | null }[] = [];
  let labelRight = -Infinity;
  for (const { index, label } of markers) {
    const x = toScreen(index);
    if (!visible(x)) continue;
    const paragraph = chartParagraph(label, colors.chart.rollMarker);
    const width = paragraph.getLongestLine();
    // 오른쪽 끝에서 잘리면 ▲ 왼쪽에 쓴다
    const labelX =
      x + MARKER_SIZE + 2 + width > chartBounds.right
        ? x - MARKER_SIZE - 2 - width
        : x + MARKER_SIZE + 2;
    const fits = labelX >= labelRight + LABEL_GAP;
    if (fits) labelRight = labelX + width;
    shown.push({ index, x, paragraph, labelX: fits ? labelX : null });
  }

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
      {shown.map(({ index, x, paragraph, labelX }) => {
        const y = chartBounds.bottom - 2;
        const triangle = Skia.PathBuilder.Make()
          .moveTo(x, y - MARKER_SIZE)
          .lineTo(x - MARKER_SIZE, y)
          .lineTo(x + MARKER_SIZE, y)
          .close()
          .detach();
        return (
          <Group key={`m${index}`}>
            <Path path={triangle} color={colors.chart.rollMarker} />
            {labelX !== null && (
              <Paragraph
                paragraph={paragraph}
                x={labelX}
                y={y - paragraph.getHeight()}
                width={paragraph.getLongestLine() + 4}
              />
            )}
          </Group>
        );
      })}
    </Group>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import type { ChartBounds, Scale } from 'victory-native';

import { spacing } from '@/theme/tokens';
import type { OverlayInsets } from './ChartOverlay';
import { cornerRect, leastCoveredCorner } from './detailCorner';
import type { ChartLine } from './LineLayer';
import type { ChartDetail } from './useChartViewport';

export type ChartScales = { xScale: Scale; yScale: Scale; chartBounds: ChartBounds };

type Size = { width: number; height: number };

const NO_INSETS: OverlayInsets = { top: 0, bottom: 0 };

type PlacementOptions = {
  detail: ChartDetail | null;
  lines: readonly ChartLine[];
  // 봉 차트면 봉마다 고가·저가(선 차트는 없음)
  bars?: readonly { high: number; low: number }[];
  // 차트 안 정보 줄 높이(지금은 위쪽만). 박스는 그 사이에 놓는다
  overlay?: OverlayInsets;
};

// 십자선 상세 박스를 차트 네 귀퉁이 중 봉·선을 가장 적게 가리는 곳에 둔다(C-a·C-c 공용, screens.md C-a 길게 누르기).
// 박스 크기는 onLayout으로 재고, 봉 좌표는 ScaleReporter가 넘긴 스케일과 봉에 붙을 때의 변환 값으로 계산한다
export function useDetailPlacement({ detail, lines, bars, overlay = NO_INSETS }: PlacementOptions) {
  const [scales, setScales] = useState<ChartScales | null>(null);
  const [boxSize, setBoxSize] = useState<Size | null>(null);
  const corner = useMemo(() => {
    if (detail === null || !scales || !boxSize) return null;
    const { xScale, yScale, chartBounds } = scales;
    const v = detail.view;
    const screenY = (price: number) => v.scaleY * yScale(price) + v.translateY;
    const index = (x: number) => xScale.invert((x - v.translateX) / v.scaleX);
    const count = bars?.length ?? Math.max(0, ...lines.map((l) => l.values.length));
    return leastCoveredCorner({
      area: detailArea(chartBounds, overlay),
      box: boxSize,
      crosshairX: detail.x,
      *marksIn(x0, x1) {
        const i1 = Math.min(Math.floor(index(x1)), count - 1);
        for (let i = Math.max(Math.ceil(index(x0)), 0); i <= i1; i++) {
          const bar = bars?.[i];
          if (bar) yield [screenY(bar.high), screenY(bar.low)] as const;
          for (const line of lines) {
            const p = line.values[i];
            if (p === null || p === undefined || p <= 0) continue;
            const y = screenY(p);
            yield [y - line.strokeWidth / 2, y + line.strokeWidth / 2] as const;
          }
        }
      },
    });
  }, [detail, scales, boxSize, bars, lines, overlay]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBoxSize((prev) =>
      prev?.width === width && prev.height === height ? prev : { width, height },
    );
  }, []);
  // 귀퉁이를 정하기 전(첫 측정)에는 감춘다
  const style =
    corner && scales && boxSize
      ? (({ left, top }) => ({ left, top }))(
          cornerRect(detailArea(scales.chartBounds, overlay), boxSize, corner),
        )
      : { opacity: 0 };

  return { setScales, boxProps: { onLayout, style } };
}

// 상세 박스 위치 계산용으로 변환 전 스케일을 넘긴다. renderOutside 안에 둔다. 스케일은 데이터가 바뀔 때만 새로 만들어진다
export function ScaleReporter({
  xScale,
  yScale,
  chartBounds,
  onScales,
}: ChartScales & { onScales: (s: ChartScales) => void }) {
  useEffect(
    () => onScales({ xScale, yScale, chartBounds }),
    [xScale, yScale, chartBounds, onScales],
  );
  return null;
}

// 상세 박스를 놓는 영역: 차트 영역에서 위·아래 정보 줄을 빼고 spacing.sm 안쪽
const detailArea = (b: ChartBounds, overlay: OverlayInsets) => ({
  left: b.left + spacing.sm,
  right: b.right - spacing.sm,
  top: b.top + overlay.top + spacing.sm,
  bottom: b.bottom - overlay.bottom - spacing.sm,
});

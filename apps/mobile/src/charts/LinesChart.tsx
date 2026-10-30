import { memo, useMemo } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { ComposedGesture } from 'react-native-gesture-handler';
import { CartesianChart, useChartPressState } from 'victory-native';
import type { ChartBounds, PointsArray } from 'victory-native';

import { spacing } from '@/theme/tokens';
import { numberFont } from './chartText';
import { CrosshairLayer } from './CrosshairLayer';
import type { CandleGeom } from './fitTransform';
import { LineLayer } from './LineLayer';
import type { ChartLine } from './LineLayer';
import { X_LABEL_HEIGHT } from './chartLayout';
import { ChartOverlay } from './ChartOverlay';
import { useChartViewport, useReportGeom } from './useChartViewport';
import type { ChartGesture } from './useChartViewport';
import { XAxisLayer } from './XAxisLayer';
import { priceLabelText, YAxisLayer } from './YAxisLayer';
import type { PriceLabel } from './YAxisLayer';

type LinesChartProps = {
  // 거래일 오름차순. 선 값은 이 순번을 따른다
  dates: readonly string[];
  lines: readonly ChartLine[];
  // 날짜마다 그날 선들의 위·아래 끝. y 자동 맞춤에 쓴다
  envelope: { hi: readonly number[]; lo: readonly number[] };
  // 모두 남기고 겹치지 않게 민다(범례 역할)
  endLabels: readonly PriceLabel[];
  // 우측 라벨 자리를 잡는 데만 쓴다(이동해도 너비가 바뀌지 않게)
  widestLabels: readonly PriceLabel[];
  priceDecimals: number;
  periodBars: number | null;
  onViewChange: (gesture: ChartGesture | null) => void;
  onVisibleRangeChange: (i0: number, i1: number) => void;
  renderDetail: (index: number) => ReactNode;
  // 차트 하단 가운데에 띄우는 버튼(차트 되돌리기). 위치는 C-a와 같다
  floating?: ReactNode;
};

const noop = () => {};

// C-c 겹친 선차트(screens.md C-c). 선형 y축, 확대·이동·십자선은 C-a와 같은 useChartViewport다.
// 십자선 가로선은 그날 값이 있는 첫 선(만기가 가장 가까운 월물)을 따라간다.
export const LinesChart = memo(function LinesChart({
  dates,
  lines,
  envelope,
  endLabels,
  widestLabels,
  priceDecimals,
  periodBars,
  onViewChange,
  onVisibleRangeChange,
  renderDetail,
  floating,
}: LinesChartProps) {
  const { state: press } = useChartPressState({ x: 0, y: { close: 0, hi: 0, lo: 0 } });
  const {
    transform,
    detail,
    width,
    onLayout,
    onGeom,
    crosshair,
    gestures,
    pressConfig,
    fittedStyle,
  } = useChartViewport({
    press,
    periodBars,
    onViewChange,
    onVisibleRangeChange,
  });

  const data = useMemo(
    () =>
      dates.map((_, i) => ({
        i,
        close: lines.map((l) => l.values[i]).find((v) => v != null) ?? envelope.lo[i],
        hi: envelope.hi[i],
        lo: envelope.lo[i],
      })),
    [dates, lines, envelope],
  );
  // 우측 y축 라벨 자리(가장 긴 끝값 라벨 + 여백)
  const yLabelWidth = useMemo(() => {
    const widths = widestLabels.map((l) =>
      numberFont.measureText(priceLabelText(l, priceDecimals)),
    );
    return Math.max(numberFont.measureText('0').width, ...widths.map((w) => w.width)) + 10;
  }, [widestLabels, priceDecimals]);

  if (dates.length === 0) return null;

  return (
    <Animated.View style={[styles.container, fittedStyle]} onLayout={onLayout}>
      <CartesianChart
        data={data}
        xKey="i"
        yKeys={['close', 'hi', 'lo']}
        transformState={transform}
        // 핀치·드래그는 useChartViewport의 gestures가 맡는다
        transformConfig={{ pan: { enabled: false }, pinch: { enabled: false } }}
        chartPressState={press}
        chartPressConfig={pressConfig}
        // CandleChart와 같은 이유로 legacy Gesture.Race를 넘긴다(D-056).
        customGestures={gestures as unknown as ComposedGesture}
        xAxis={{ font: null, lineColor: 'transparent' }}
        yAxis={[{ font: null, lineColor: 'transparent' }]}
        padding={{ bottom: X_LABEL_HEIGHT, right: yLabelWidth }}
        renderOutside={({ points, chartBounds, canvasSize, xScale, yScale }) => {
          const x0 = points.hi[0]?.x ?? 0;
          const dx = (points.hi[1]?.x ?? 0) - x0;
          return (
            <>
              <XAxisLayer
                dates={dates}
                chartBounds={chartBounds}
                x0={x0}
                dx={dx}
                crosshair={crosshair}
              />
              <YAxisLayer
                yScale={yScale}
                chartBounds={chartBounds}
                priceDecimals={priceDecimals}
                labels={endLabels}
                labelLayout="stack"
                currentPrice={null}
                crosshair={crosshair}
              />
              <LineLayer
                lines={lines}
                xScale={xScale}
                yScale={yScale}
                chartBounds={chartBounds}
                transform={transform}
              />
              <CrosshairLayer
                press={press}
                crosshair={crosshair}
                chartBounds={chartBounds}
                canvasWidth={canvasSize.width}
                dates={dates}
                priceDecimals={priceDecimals}
                font={numberFont}
              />
            </>
          );
        }}
      >
        {({ points, chartBounds }) => (
          <GeomReporter points={points} chartBounds={chartBounds} onGeom={onGeom} />
        )}
      </CartesianChart>
      <ChartOverlay bottomOffset={X_LABEL_HEIGHT} floating={floating} onInsets={noop} />
      {detail !== null && dates[detail.index] && (
        <View
          pointerEvents="none"
          style={[
            styles.detail,
            detail.side === 'left' ? { left: spacing.sm } : { left: width / 2 },
          ]}
        >
          {renderDetail(detail.index)}
        </View>
      )}
    </Animated.View>
  );
});

type GeomReporterProps = {
  points: Record<'close' | 'hi' | 'lo', PointsArray>;
  chartBounds: ChartBounds;
  onGeom: (g: CandleGeom) => void;
};

// 선은 renderOutside의 LineLayer가 그린다. 여기서는 변환 전 좌표만 넘긴다.
function GeomReporter({ points, chartBounds, onGeom }: GeomReporterProps) {
  useReportGeom(points.hi, points.lo, chartBounds, onGeom);
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  detail: {
    position: 'absolute',
    top: spacing.sm,
  },
});

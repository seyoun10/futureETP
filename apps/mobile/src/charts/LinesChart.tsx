import { memo, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { ComposedGesture } from 'react-native-gesture-handler';
import { CartesianChart, useChartPressState } from 'victory-native';
import type { ChartBounds, PointsArray } from 'victory-native';

import { formatPrice } from '@/lib/formatNumber';
import { numberFont } from './chartText';
import { CrosshairLayer } from './CrosshairLayer';
import type { CandleGeom } from './fitTransform';
import { LineLayer } from './LineLayer';
import type { ChartLine } from './LineLayer';
import { X_LABEL_HEIGHT, Y_LABEL_PAD } from './chartLayout';
import { ChartOverlay } from './ChartOverlay';
import type { OverlayInsets } from './ChartOverlay';
import { ChartResetButton } from './ChartResetButton';
import { useChartViewport, useReportGeom } from './useChartViewport';
import { ScaleReporter, useDetailPlacement } from './useDetailPlacement';
import type { ChartGesture, DateSpan } from './useChartViewport';
import { XAxisLayer } from './XAxisLayer';
import { YAxisLayer } from './YAxisLayer';
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
  // 차트 안 위쪽에 겹치는 정보 줄(ChartOverlay, 선 색 범례). 선은 줄을 비켜 그린다
  overlayTop?: ReactNode;
  // 있으면 차트 하단 가운데에 되돌리기 버튼을 띄운다(위치는 C-a와 같다). 누르면 십자선·상세 박스를 지우고 부른다
  onResetView?: () => void;
  // 과거 데이터를 받는 동안 모든 터치(십자선·되돌리기 버튼 포함)를 막는다(D-108)
  locked?: boolean;
};

const NO_GUIDES: [] = [];

// CartesianChart에 넘기는 설정은 모듈 상수·memo로 고정한다. victory-native는 yKeys·padding·축 설정이
// 바뀌면(새 배열·객체여도) 모든 봉의 좌표를 다시 계산해, 보이는 범위가 바뀔 때마다 JS 스레드가 수 초 멈췄다
const Y_KEYS: ('close' | 'hi' | 'lo')[] = ['close', 'hi', 'lo'];
// y축은 C-a처럼 log. 0 이하 값이 있으면(2020-04 CL 음수 정산) log를 못 써 선형으로 둔다
const LOG_AXIS = { axisScales: { yAxisScale: 'log' } } as const;
const LINEAR_AXIS = { axisScales: { yAxisScale: 'linear' } } as const;
// 핀치·드래그는 useChartViewport의 gestures가 맡는다
const TRANSFORM_CONFIG = { pan: { enabled: false }, pinch: { enabled: false } };
// 라이브러리 축은 끄고 레이어로 그린다
const X_AXIS = { font: null, lineColor: 'transparent' };
const Y_AXES = [{ font: null, lineColor: 'transparent' }];

// C-c 겹친 선차트(screens.md C-c). log y축(C-a와 같다), 확대·이동·십자선은 C-a와 같은 useChartViewport다.
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
  overlayTop,
  onResetView,
  locked,
}: LinesChartProps) {
  const { state: press } = useChartPressState({ x: 0, y: { close: 0, hi: 0, lo: 0 } });
  const [overlay, setOverlay] = useState<OverlayInsets>({ top: 0, bottom: 0 });
  const {
    transform,
    detail,
    onGeom,
    crosshair,
    hideCrosshair,
    gestures,
    pressConfig,
    fittedStyle,
  } = useChartViewport({
    press,
    periodBars,
    onViewChange,
    onVisibleRangeChange,
    dataInsets: overlay,
    locked,
  });

  const { setScales, boxProps } = useDetailPlacement({ detail, lines, overlay });

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
      numberFont.measureText(formatPrice(l.price, priceDecimals)),
    );
    return Math.max(numberFont.measureText('0').width, ...widths.map((w) => w.width)) + Y_LABEL_PAD;
  }, [widestLabels, priceDecimals]);
  const axisOptions = useMemo(
    () => (envelope.lo.every((v) => v > 0) ? LOG_AXIS : LINEAR_AXIS),
    [envelope.lo],
  );
  // 여백은 x축·y축 라벨 자리
  const padding = useMemo(() => ({ bottom: X_LABEL_HEIGHT, right: yLabelWidth }), [yLabelWidth]);

  if (dates.length === 0) return null;

  return (
    <Animated.View style={[styles.container, fittedStyle]} pointerEvents={locked ? 'none' : 'auto'}>
      <CartesianChart
        data={data}
        xKey="i"
        yKeys={Y_KEYS}
        axisOptions={axisOptions}
        transformState={transform}
        transformConfig={TRANSFORM_CONFIG}
        chartPressState={press}
        chartPressConfig={pressConfig}
        // CandleChart와 같은 이유로 legacy Gesture.Race를 넘긴다(D-056).
        customGestures={gestures as unknown as ComposedGesture}
        xAxis={X_AXIS}
        yAxis={Y_AXES}
        padding={padding}
        renderOutside={({ points, chartBounds, canvasSize, xScale, yScale }) => {
          const x0 = points.hi[0]?.x ?? 0;
          const dx = (points.hi[1]?.x ?? 0) - x0;
          return (
            <>
              <ScaleReporter
                xScale={xScale}
                yScale={yScale}
                chartBounds={chartBounds}
                onScales={setScales}
              />
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
                guides={NO_GUIDES}
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
          <GeomReporter points={points} chartBounds={chartBounds} dates={dates} onGeom={onGeom} />
        )}
      </CartesianChart>
      <ChartOverlay
        top={overlayTop}
        bottomOffset={X_LABEL_HEIGHT}
        floating={
          onResetView ? (
            <ChartResetButton
              onPress={() => {
                hideCrosshair();
                onResetView();
              }}
            />
          ) : undefined
        }
        onInsets={setOverlay}
      />
      {detail !== null && dates[detail.index] && (
        <View
          pointerEvents="none"
          onLayout={boxProps.onLayout}
          style={[styles.detail, boxProps.style]}
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
  dates: readonly string[];
  onGeom: (g: CandleGeom, span: DateSpan) => void;
};

// 선은 renderOutside의 LineLayer가 그린다. 여기서는 변환 전 좌표만 넘긴다.
function GeomReporter({ points, chartBounds, dates, onGeom }: GeomReporterProps) {
  useReportGeom(points.hi, points.lo, chartBounds, dates, onGeom);
  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  detail: {
    position: 'absolute',
  },
});

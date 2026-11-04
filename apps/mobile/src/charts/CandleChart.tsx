import { memo, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import type { ComposedGesture } from 'react-native-gesture-handler';
import { CartesianChart, Candlestick, useChartPressState } from 'victory-native';
import type { ChartBounds, PointsArray } from 'victory-native';

import { formatPrice } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';
import { useUpDownPalette } from '@/theme/upDownColor';
import { ChartOverlay } from './ChartOverlay';
import type { OverlayInsets } from './ChartOverlay';
import { ChartResetButton } from './ChartResetButton';
import { numberFont } from './chartText';
import { CrosshairLayer } from './CrosshairLayer';
import { ExtremeTagsLayer } from './ExtremeTagsLayer';
import type { CandleGeom } from './fitTransform';
import { LineLayer } from './LineLayer';
import type { ChartLine } from './LineLayer';
import { RollLayer } from './RollLayer';
import type { RollMarks } from './RollLayer';
import { X_LABEL_HEIGHT } from './chartLayout';
import { useChartViewport, useReportGeom } from './useChartViewport';
import { ScaleReporter, useDetailPlacement } from './useDetailPlacement';
import type { ChartGesture, DateSpan } from './useChartViewport';
import { XAxisLayer } from './XAxisLayer';
import { YAxisLayer } from './YAxisLayer';
import type { PriceLabel } from './YAxisLayer';

export type CandleBar = {
  tradeDate: string;
  open: number;
  high: number;
  low: number;
  close: number;
};

type CandleChartProps = {
  // 거래일 오름차순, 마지막 봉이 현재가
  bars: readonly CandleBar[];
  // 봉마다 그 봉 위 선까지 포함한 위·아래 끝 가격. y 자동 맞춤과 기본 y 범위에 쓴다
  envelope: { hi: readonly number[]; lo: readonly number[] };
  lines: readonly ChartLine[];
  // 보이는 마지막 봉 기준 값. 겹치면 위·아래로 민다
  priceLabels: readonly PriceLabel[];
  // 회색 수평 점선 가격(보이는 마지막 봉 종가). 마지막 봉 종가는 흰색 점선으로 함께 그린다
  guidePrice: number;
  priceDecimals: number;
  roll: RollMarks;
  // 기간 버튼이 고른 봉 수. 제스처로 범위를 바꾸면 onViewChange 뒤 null로 받는다
  periodBars: number | null;
  onViewChange: (gesture: ChartGesture | null) => void;
  // 보이는 봉 [i0, i1]이 바뀔 때(저점대비·고점대비 같은 차트 밖 표시용)
  onVisibleRangeChange?: (i0: number, i1: number) => void;
  // 십자선 상세 박스 내용. 박스는 차트가 봉·선을 가장 적게 가리는 귀퉁이에 둔다
  renderDetail: (index: number) => ReactNode;
  // 차트 안 위·아래에 겹치는 정보 줄(ChartOverlay)
  overlayTop?: ReactNode;
  overlayBottom?: ReactNode;
  // 있으면 아래 줄 위에 되돌리기 버튼을 띄운다. 누르면 십자선·상세 박스를 지우고 부른다
  onResetView?: () => void;
  // 과거 데이터를 받는 동안 모든 터치(십자선·되돌리기 버튼 포함)를 막는다(D-108)
  locked?: boolean;
};

// CartesianChart에 넘기는 설정은 모듈 상수·memo로 고정한다. victory-native는 yKeys·padding·축 설정이
// 바뀌면(새 배열·객체여도) 모든 봉의 좌표를 다시 계산해, 보이는 범위가 바뀔 때마다 JS 스레드가 수 초 멈췄다
const Y_KEYS: ('open' | 'high' | 'low' | 'close' | 'hi' | 'lo')[] = [
  'open',
  'high',
  'low',
  'close',
  'hi',
  'lo',
];
const AXIS_OPTIONS = { axisScales: { yAxisScale: 'log' } } as const;
// 핀치·드래그는 useChartViewport의 gestures가 맡는다
const TRANSFORM_CONFIG = { pan: { enabled: false }, pinch: { enabled: false } };
// 라이브러리 축은 끄고 레이어로 그린다
const X_AXIS = { font: null, lineColor: 'transparent' };
const Y_AXES = [{ font: null, lineColor: 'transparent' }];

// C-a 일봉 차트(D-056, D-087). log y축, 확대·이동·십자선은 useChartViewport(C-c와 공용),
// 우측 y축 특수 라벨, 롤 음영, 최고가·최저가 꼬리표.
export const CandleChart = memo(function CandleChart({
  bars,
  envelope,
  lines,
  priceLabels,
  guidePrice,
  priceDecimals,
  roll,
  periodBars,
  onViewChange,
  onVisibleRangeChange,
  renderDetail,
  overlayTop,
  overlayBottom,
  onResetView,
  locked,
}: CandleChartProps) {
  const palette = useUpDownPalette();
  const { state: press } = useChartPressState({
    x: 0,
    y: { open: 0, high: 0, low: 0, close: 0, hi: 0, lo: 0 },
  });
  const [overlay, setOverlay] = useState<OverlayInsets>({ top: 0, bottom: 0 });
  const dataInsets = overlay;
  const dates = useMemo(() => bars.map((b) => b.tradeDate), [bars]);
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
    dataInsets,
    locked,
  });

  const data = useMemo(
    () =>
      bars.map((b, i) => ({ ...b, i, hi: envelope.hi[i] ?? b.high, lo: envelope.lo[i] ?? b.low })),
    [bars, envelope],
  );
  const { setScales, boxProps } = useDetailPlacement({ detail, lines, bars, overlay });

  const current = bars[bars.length - 1];
  // 마지막 봉이 보이면 두 점선이 겹치므로 흰색을 위에 그린다
  const guides = useMemo(
    () =>
      current
        ? [
            { price: guidePrice, color: colors.chart.currentPrice },
            { price: current.close, color: colors.chart.lastPrice },
          ]
        : [],
    [current, guidePrice],
  );
  // 우측 y축 라벨 자리(가장 큰 가격 라벨 + 여백)
  const yLabelWidth = useMemo(() => {
    const max = Math.max(1, ...envelope.hi);
    return numberFont.measureText(formatPrice(max, priceDecimals)).width + 10;
  }, [envelope, priceDecimals]);
  // 여백은 x축·y축 라벨 자리
  const padding = useMemo(() => ({ bottom: X_LABEL_HEIGHT, right: yLabelWidth }), [yLabelWidth]);

  if (!current) return null;

  return (
    <Animated.View style={[styles.container, fittedStyle]} pointerEvents={locked ? 'none' : 'auto'}>
      <CartesianChart
        data={data}
        xKey="i"
        yKeys={Y_KEYS}
        axisOptions={AXIS_OPTIONS}
        transformState={transform}
        transformConfig={TRANSFORM_CONFIG}
        chartPressState={press}
        chartPressConfig={pressConfig}
        // victory-native 42 타입은 RNGH 3의 새 ComposedGesture를 가리키지만, 런타임은 legacy Gesture.Race로 합친다(D-056).
        customGestures={gestures as unknown as ComposedGesture}
        xAxis={X_AXIS}
        yAxis={Y_AXES}
        padding={padding}
        renderOutside={({ points, chartBounds, canvasSize, xScale, yScale }) => {
          const x0 = points.high[0]?.x ?? 0;
          const dx = (points.high[1]?.x ?? 0) - x0;
          return (
            <>
              <ScaleReporter
                xScale={xScale}
                yScale={yScale}
                chartBounds={chartBounds}
                onScales={setScales}
              />
              <RollLayer {...roll} count={dates.length} chartBounds={chartBounds} x0={x0} dx={dx} />
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
                labels={priceLabels}
                guides={guides}
                crosshair={crosshair}
              />
              <LineLayer
                lines={lines}
                xScale={xScale}
                yScale={yScale}
                chartBounds={chartBounds}
                transform={transform}
              />
              <ExtremeTagsLayer
                bars={bars}
                currentPrice={current.close}
                guidePrice={guidePrice}
                priceDecimals={priceDecimals}
                yScale={yScale}
                chartBounds={chartBounds}
                x0={x0}
                dx={dx}
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
          <CandleLayer
            points={points}
            chartBounds={chartBounds}
            dates={dates}
            onGeom={onGeom}
            colors={{ positive: palette.up, negative: palette.down }}
          />
        )}
      </CartesianChart>
      <ChartOverlay
        top={overlayTop}
        bottom={overlayBottom}
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
      {detail !== null && bars[detail.index] && (
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

type CandleLayerProps = {
  points: Record<'open' | 'high' | 'low' | 'close' | 'hi' | 'lo', PointsArray>;
  chartBounds: ChartBounds;
  dates: readonly string[];
  onGeom: (g: CandleGeom, span: DateSpan) => void;
  colors: { positive: string; negative: string };
};

// 봉을 그리고, 변환 전 픽셀 좌표(봉과 선의 위·아래 끝)를 worklet이 읽을 수 있게 넘긴다.
function CandleLayer({ points, chartBounds, dates, onGeom, colors }: CandleLayerProps) {
  useReportGeom(points.hi, points.lo, chartBounds, dates, onGeom);

  return (
    <Candlestick
      openPoints={points.open}
      highPoints={points.high}
      lowPoints={points.low}
      closePoints={points.close}
      chartBounds={chartBounds}
      candleColors={colors}
      // 0 = Skia 헤어라인: 변환 행렬로 확대해도 꼬리가 1px로 유지된다.
      wickStrokeWidth={0}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  detail: {
    position: 'absolute',
  },
});

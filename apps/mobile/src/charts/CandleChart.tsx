import { memo, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { ComposedGesture } from 'react-native-gesture-handler';
import { CartesianChart, Candlestick, useChartPressState } from 'victory-native';
import type { ChartBounds, PointsArray } from 'victory-native';

import { formatPrice } from '@/lib/formatNumber';
import { spacing } from '@/theme/tokens';
import { useUpDownPalette } from '@/theme/upDownColor';
import { ChartOverlay } from './ChartOverlay';
import type { OverlayInsets } from './ChartOverlay';
import { numberFont } from './chartText';
import { CrosshairLayer } from './CrosshairLayer';
import { ExtremeTagsLayer } from './ExtremeTagsLayer';
import type { CandleGeom } from './fitTransform';
import { LineLayer } from './LineLayer';
import type { ChartLine } from './LineLayer';
import { RollLayer } from './RollLayer';
import type { RollMarks } from './RollLayer';
import { ROLL_MARKER_ROW_HEIGHT, X_LABEL_HEIGHT } from './chartLayout';
import { useChartViewport, useReportGeom } from './useChartViewport';
import type { ChartGesture } from './useChartViewport';
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
  // 우선순위 순서
  priceLabels: readonly PriceLabel[];
  priceDecimals: number;
  roll: RollMarks;
  // 기간 버튼이 고른 봉 수. 제스처로 범위를 바꾸면 onViewChange 뒤 null로 받는다
  periodBars: number | null;
  onViewChange: (gesture: ChartGesture | null) => void;
  // 보이는 봉 [i0, i1]이 바뀔 때(저점대비·고점대비 같은 차트 밖 표시용)
  onVisibleRangeChange?: (i0: number, i1: number) => void;
  // 십자선 상세 박스 내용. 박스 위치는 차트가 손가락 반대편으로 정한다
  renderDetail: (index: number) => ReactNode;
  // 차트 안 위·아래에 겹치는 정보 줄과 아래 줄 위에 띄우는 버튼(ChartOverlay)
  overlayTop?: ReactNode;
  overlayBottom?: ReactNode;
  floating?: ReactNode;
};

// 아래 정보 줄은 x축 라벨·롤 마커 줄 위에 둔다
const OVERLAY_BOTTOM_OFFSET = X_LABEL_HEIGHT + ROLL_MARKER_ROW_HEIGHT;

// C-a 일봉 차트(D-056, D-087). log y축, 확대·이동·십자선은 useChartViewport(C-c와 공용),
// 우측 y축 특수 라벨, 롤 음영·마커, 최고가·최저가 꼬리표.
export const CandleChart = memo(function CandleChart({
  bars,
  envelope,
  lines,
  priceLabels,
  priceDecimals,
  roll,
  periodBars,
  onViewChange,
  onVisibleRangeChange,
  renderDetail,
  overlayTop,
  overlayBottom,
  floating,
}: CandleChartProps) {
  const palette = useUpDownPalette();
  const { state: press } = useChartPressState({
    x: 0,
    y: { open: 0, high: 0, low: 0, close: 0, hi: 0, lo: 0 },
  });
  const [overlay, setOverlay] = useState<OverlayInsets>({ top: 0, bottom: 0 });
  // 아래 줄은 롤 마커 줄 위에 있어 그 줄 높이까지 비운다
  const dataInsets = useMemo(
    () => ({
      top: overlay.top,
      bottom: overlay.bottom > 0 ? overlay.bottom + ROLL_MARKER_ROW_HEIGHT : 0,
    }),
    [overlay],
  );
  const { transform, detail, width, onLayout, onGeom, crosshair, gestures, pressConfig } =
    useChartViewport({ press, periodBars, onViewChange, onVisibleRangeChange, dataInsets });

  const data = useMemo(
    () =>
      bars.map((b, i) => ({ ...b, i, hi: envelope.hi[i] ?? b.high, lo: envelope.lo[i] ?? b.low })),
    [bars, envelope],
  );
  const dates = useMemo(() => bars.map((b) => b.tradeDate), [bars]);
  const current = bars[bars.length - 1];
  // 우측 y축 라벨 자리(가장 큰 가격 라벨 + 여백)
  const yLabelWidth = useMemo(() => {
    const max = Math.max(1, ...envelope.hi);
    return numberFont.measureText(formatPrice(max, priceDecimals)).width + 10;
  }, [envelope, priceDecimals]);

  if (!current) return null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <CartesianChart
        data={data}
        xKey="i"
        yKeys={['open', 'high', 'low', 'close', 'hi', 'lo']}
        axisOptions={{ axisScales: { yAxisScale: 'log' } }}
        transformState={transform}
        // 핀치·드래그는 useChartViewport의 gestures가 맡는다
        transformConfig={{ pan: { enabled: false }, pinch: { enabled: false } }}
        chartPressState={press}
        chartPressConfig={pressConfig}
        // victory-native 42 타입은 RNGH 3의 새 ComposedGesture를 가리키지만, 런타임은 legacy Gesture.Race로 합친다(D-056).
        customGestures={gestures as unknown as ComposedGesture}
        // 라이브러리 축은 끄고 레이어로 그린다. 여백은 라벨 자리
        xAxis={{ font: null, lineColor: 'transparent' }}
        yAxis={[{ font: null, lineColor: 'transparent' }]}
        padding={{ bottom: X_LABEL_HEIGHT, right: yLabelWidth }}
        renderOutside={({ points, chartBounds, canvasSize, xScale, yScale }) => {
          const x0 = points.high[0]?.x ?? 0;
          const dx = (points.high[1]?.x ?? 0) - x0;
          return (
            <>
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
                currentPrice={current.close}
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
            onGeom={onGeom}
            colors={{ positive: palette.up, negative: palette.down }}
          />
        )}
      </CartesianChart>
      <ChartOverlay
        top={overlayTop}
        bottom={overlayBottom}
        bottomOffset={OVERLAY_BOTTOM_OFFSET}
        floating={floating}
        onInsets={setOverlay}
      />
      {detail !== null && bars[detail.index] && (
        <View
          pointerEvents="none"
          style={[
            styles.detail,
            { top: styles.detail.top + overlay.top },
            detail.side === 'left' ? { left: spacing.sm } : { left: width / 2 },
          ]}
        >
          {renderDetail(detail.index)}
        </View>
      )}
    </View>
  );
});

type CandleLayerProps = {
  points: Record<'open' | 'high' | 'low' | 'close' | 'hi' | 'lo', PointsArray>;
  chartBounds: ChartBounds;
  onGeom: (g: CandleGeom) => void;
  colors: { positive: string; negative: string };
};

// 봉을 그리고, 변환 전 픽셀 좌표(봉과 선의 위·아래 끝)를 worklet이 읽을 수 있게 넘긴다.
function CandleLayer({ points, chartBounds, onGeom, colors }: CandleLayerProps) {
  useReportGeom(points.hi, points.lo, chartBounds, onGeom);

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
    top: spacing.sm,
  },
});

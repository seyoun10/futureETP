import * as Haptics from 'expo-haptics';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import type { ComposedGesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import {
  CartesianChart,
  Candlestick,
  getTransformComponents,
  setScale,
  setTranslate,
  useChartPressState,
  useChartTransformState,
} from 'victory-native';
import type { ChartBounds, PointsArray } from 'victory-native';
import { scheduleOnRN } from 'react-native-worklets';

import { formatPrice } from '@/lib/formatNumber';
import { spacing } from '@/theme/tokens';
import { useUpDownPalette } from '@/theme/upDownColor';
import { numberFont } from './chartText';
import { CrosshairLayer, useCrosshairPosition } from './CrosshairLayer';
import type { ChartTransform } from './CrosshairLayer';
import { ExtremeTagsLayer } from './ExtremeTagsLayer';
import { fitTransform, periodTransform, visibleRange } from './fitTransform';
import type { CandleGeom, Transform } from './fitTransform';
import { LineLayer } from './LineLayer';
import type { ChartLine } from './LineLayer';
import { RollLayer } from './RollLayer';
import type { RollMarks } from './RollLayer';
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
  // 기간 버튼이 고른 봉 수. 제스처로 범위를 바꾸면 onGestureStart 뒤 null로 받는다
  periodBars: number | null;
  onGestureStart: () => void;
  // 보이는 봉 [i0, i1]이 바뀔 때(저점대비·고점대비 같은 차트 밖 표시용)
  onVisibleRangeChange?: (i0: number, i1: number) => void;
  // 십자선 상세 박스 내용. 박스 위치는 차트가 손가락 반대편으로 정한다
  renderDetail: (index: number) => ReactNode;
};

const EPSILON = 1e-3;
const LONG_PRESS_MS = 300;
const X_LABEL_HEIGHT = 20;

const applyTransform = (state: ChartTransform, t: Transform) => {
  'worklet';
  state.matrix.set(setTranslate(setScale(state.matrix.get(), t.k, t.ky), t.tx, t.ty));
};

type Detail = { index: number; side: 'left' | 'right' };

// C-a·C-c 공용 일봉 차트(D-056, D-087). log y축, x축만 핀치·드래그, 보이는 봉과 선 기준 y 자동 맞춤,
// 길게 누르기 십자선(봉에 붙을 때 햅틱), 우측 y축 특수 라벨, 롤 음영·마커, 최고가·최저가 꼬리표.
export const CandleChart = memo(function CandleChart({
  bars,
  envelope,
  lines,
  priceLabels,
  priceDecimals,
  roll,
  periodBars,
  onGestureStart,
  onVisibleRangeChange,
  renderDetail,
}: CandleChartProps) {
  const palette = useUpDownPalette();
  const { state: transform } = useChartTransformState();
  const geom = useSharedValue<CandleGeom | null>(null);
  const { state: press } = useChartPressState({
    x: 0,
    y: { open: 0, high: 0, low: 0, close: 0, hi: 0, lo: 0 },
  });
  const [zoomed, setZoomed] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [width, setWidth] = useState(0);
  const widthValue = useSharedValue(0);

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

  // 기간 버튼: 마지막 periodBars개 봉이 보이게. 봉 좌표가 바뀌면(새로고침·회전) 같은 기간으로 다시 맞추고,
  // 기간이 없으면(제스처로 고른 범위) 지금 배율·이동을 새 좌표에 맞춰 y만 다시 맞춘다
  const [geomVersion, setGeomVersion] = useState(0);
  const onGeom = useCallback(
    (g: CandleGeom) => {
      geom.set(g);
      setGeomVersion((v) => v + 1);
    },
    [geom],
  );
  useEffect(() => {
    const g = geom.get();
    if (!g) return;
    if (periodBars !== null) {
      applyTransform(transform, periodTransform(g, periodBars));
    } else {
      const c = getTransformComponents(transform.matrix.get());
      applyTransform(transform, fitTransform(g, c.scaleX, c.translateX));
    }
  }, [geom, geomVersion, periodBars, transform]);

  // 제스처가 행렬을 바꿀 때마다 x 범위 제한 + y 자동 맞춤(UI 스레드, D-056)
  useAnimatedReaction(
    () => transform.matrix.get(),
    (m) => {
      const g = geom.get();
      if (!g) return;
      const c = getTransformComponents(m);
      const t = fitTransform(g, c.scaleX, c.translateX);
      if (
        Math.abs(t.k - c.scaleX) < EPSILON &&
        Math.abs(t.tx - c.translateX) < EPSILON &&
        Math.abs(t.ky - c.scaleY) < EPSILON &&
        Math.abs(t.ty - c.translateY) < EPSILON
      ) {
        return;
      }
      applyTransform(transform, t);
    },
  );

  // '전체'(k=1)에서는 이동 제스처를 막는다. 이동이 x를 바꾸고 보정이 되돌리는 쓰기 충돌로 끊긴다(D-056)
  useAnimatedReaction(
    () => getTransformComponents(transform.matrix.get()).scaleX > 1 + EPSILON,
    (next, prev) => {
      if (next !== prev) scheduleOnRN(setZoomed, next);
    },
  );

  // 보이는 봉 범위가 바뀌면 알린다(정수 범위라 봉 하나만큼 움직일 때만)
  const rangeChanged = useCallback(
    (i0: number, i1: number) => onVisibleRangeChange?.(i0, i1),
    [onVisibleRangeChange],
  );
  useAnimatedReaction(
    () => {
      const g = geom.get();
      if (!g) return null;
      const c = getTransformComponents(transform.matrix.get());
      return visibleRange(g, c.scaleX, c.translateX);
    },
    (range, prev) => {
      if (!range || (prev && range[0] === prev[0] && range[1] === prev[1])) return;
      scheduleOnRN(rangeChanged, range[0], range[1]);
    },
  );

  // 제스처가 시작되면 기간 선택 해제(screens.md C-a)
  useAnimatedReaction(
    () => transform.panActive.get() || transform.zoomActive.get(),
    (active, prev) => {
      if (active && !prev) scheduleOnRN(onGestureStart);
    },
  );

  // 십자선은 손을 떼도 남고, 차트를 한 번 더 누르면 사라진다(D-056).
  const crosshairVisible = useSharedValue(false);
  useAnimatedReaction(
    () => press.isActive.get(),
    (active) => {
      if (active) crosshairVisible.set(true);
    },
  );
  const crosshair = useCrosshairPosition(press, transform, crosshairVisible);
  const hideCrosshairTap = useMemo(
    () =>
      Gesture.Tap().onEnd(() => {
        crosshairVisible.set(false);
        scheduleOnRN(setDetail, null);
      }),
    [crosshairVisible],
  );

  // 봉에 붙을 때마다 햅틱 + 상세 박스 갱신. 박스는 손가락 반대편에 둔다(screens.md C-a 십자선)
  const onSnap = useCallback((index: number, side: Detail['side']) => {
    setDetail({ index, side });
    void Haptics.selectionAsync();
  }, []);
  useAnimatedReaction(
    () => (press.isActive.get() ? press.matchedIndex.get() : -1),
    (idx, prev) => {
      if (idx < 0 || idx === prev) return;
      scheduleOnRN(onSnap, idx, crosshair.x.get() < widthValue.get() / 2 ? 'right' : 'left');
    },
  );

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
    widthValue.set(e.nativeEvent.layout.width);
  };

  if (!current) return null;

  return (
    <View style={styles.container} onLayout={onLayout}>
      <CartesianChart
        data={data}
        xKey="i"
        yKeys={['open', 'high', 'low', 'close', 'hi', 'lo']}
        axisOptions={{ axisScales: { yAxisScale: 'log' } }}
        transformState={transform}
        transformConfig={{
          pan: { enabled: zoomed, dimensions: 'x' },
          pinch: { dimensions: 'x' },
        }}
        chartPressState={press}
        chartPressConfig={{ pan: { activateAfterLongPress: LONG_PRESS_MS } }}
        // victory-native 42 타입은 RNGH 3의 새 ComposedGesture를 가리키지만, 런타임은 legacy Gesture.Race로 합친다(D-056).
        customGestures={Gesture.Race(hideCrosshairTap) as unknown as ComposedGesture}
        // 라이브러리 축은 끄고 레이어로 그린다. 여백은 라벨 자리
        xAxis={{ font: null, lineColor: 'transparent' }}
        yAxis={[{ font: null, lineColor: 'transparent' }]}
        padding={{ bottom: X_LABEL_HEIGHT, right: yLabelWidth }}
        renderOutside={({ points, chartBounds, canvasSize, xScale, yScale }) => {
          const x0 = points.high[0]?.x ?? 0;
          const dx = (points.high[1]?.x ?? 0) - x0;
          return (
            <>
              <RollLayer {...roll} chartBounds={chartBounds} x0={x0} dx={dx} />
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
      {detail !== null && bars[detail.index] && (
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
  useEffect(() => {
    const first = points.high[0];
    if (!first) return;
    const second = points.high[1];
    onGeom({
      left: chartBounds.left,
      right: chartBounds.right,
      top: chartBounds.top,
      bottom: chartBounds.bottom,
      x0: first.x,
      // 봉이 하나뿐이면 차트 폭을 간격으로 둔다
      dx: second ? second.x - first.x : chartBounds.right - chartBounds.left,
      highY: points.hi.map((p) => p.y ?? 0),
      lowY: points.lo.map((p) => p.y ?? 0),
    });
  }, [points, chartBounds, onGeom]);

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

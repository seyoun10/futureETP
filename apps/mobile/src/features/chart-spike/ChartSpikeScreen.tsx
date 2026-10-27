import { matchFont } from '@shopify/react-native-skia';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAnimatedReaction, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
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

import { CrosshairLayer } from './CrosshairLayer';
import { fitTransform, periodTransform } from './fitTransform';
import type { CandleGeom } from './fitTransform';
import { makeSyntheticBars } from './syntheticBars';
import { XAxisLayer } from './XAxisLayer';

// C-a 차트 스파이크(D-032). 검증용 화면이라 테마 토큰·i18n은 붙이지 않는다.
const BAR_COUNT = 4000;
const EPSILON = 1e-3;
const LONG_PRESS_MS = 300;

const PERIODS = [
  { label: '3M', bars: 63 },
  { label: '12M', bars: 252 },
  { label: '4Y', bars: 1008 },
  { label: 'ALL', bars: BAR_COUNT },
] as const;

const font = matchFont({
  fontFamily: Platform.select({ ios: 'Helvetica', default: 'sans-serif' }),
  fontSize: 11,
});

type CandleLayerProps = {
  points: Record<'open' | 'high' | 'low' | 'close', PointsArray>;
  chartBounds: ChartBounds;
  geom: SharedValue<CandleGeom | null>;
};

// 봉을 그리고, 기본 픽셀 좌표를 worklet이 읽을 수 있게 넘긴다.
function CandleLayer({ points, chartBounds, geom }: CandleLayerProps) {
  useEffect(() => {
    const first = points.high[0];
    const second = points.high[1];
    if (!first || !second) return;
    geom.set({
      left: chartBounds.left,
      right: chartBounds.right,
      top: chartBounds.top,
      bottom: chartBounds.bottom,
      x0: first.x,
      dx: second.x - first.x,
      highY: points.high.map((p) => p.y ?? 0),
      lowY: points.low.map((p) => p.y ?? 0),
    });
  }, [points, chartBounds, geom]);

  return (
    <Candlestick
      openPoints={points.open}
      highPoints={points.high}
      lowPoints={points.low}
      closePoints={points.close}
      chartBounds={chartBounds}
      candleColors={{ positive: '#ef5350', negative: '#42a5f5' }}
      // 0 = Skia 헤어라인: 변환 행렬로 확대해도 꼬리가 1px로 유지된다.
      wickStrokeWidth={0}
    />
  );
}

export function ChartSpikeScreen() {
  const bars = useMemo(() => makeSyntheticBars(BAR_COUNT), []);
  const dates = useMemo(() => bars.map((b) => b.date), [bars]);
  const { state: transform } = useChartTransformState();
  const geom = useSharedValue<CandleGeom | null>(null);
  const [period, setPeriod] = useState<number | null>(252);
  const [fps, setFps] = useState({ avg: 0, worst: 0 });
  const { state: press } = useChartPressState({
    x: 0,
    y: { open: 0, high: 0, low: 0, close: 0 },
  });
  const [snapCount, setSnapCount] = useState(0);

  // 십자선이 다른 봉에 붙을 때마다 햅틱(D-032). 실기기에서만 느껴진다.
  const onSnap = () => {
    setSnapCount((n) => n + 1);
    void Haptics.selectionAsync();
  };
  useAnimatedReaction(
    () => (press.isActive.get() ? press.matchedIndex.get() : -1),
    (idx, prev) => {
      if (idx >= 0 && idx !== prev) scheduleOnRN(onSnap);
    },
  );

  // 기간 버튼(최초 12M). 제스처로 범위를 바꾸면 선택 표시를 해제한다(screens.md C-a).
  const applyPeriod = (barCount: number) => {
    setPeriod(barCount);
    const g = geom.get();
    if (!g) return;
    const t = periodTransform(g, barCount);
    transform.matrix.set(setTranslate(setScale(transform.matrix.get(), t.k, t.ky), t.tx, t.ty));
  };

  // 봉 좌표가 처음 준비되면 12M로 맞춘다.
  useAnimatedReaction(
    () => geom.get(),
    (g, prev) => {
      if (!g || prev) return;
      const t = periodTransform(g, 252);
      transform.matrix.set(setTranslate(setScale(transform.matrix.get(), t.k, t.ky), t.tx, t.ty));
    },
  );

  // 제스처가 행렬을 바꿀 때마다 x 범위 제한 + y 자동 맞춤(UI 스레드)
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
      transform.matrix.set(setTranslate(setScale(m, t.k, t.ky), t.tx, t.ty));
    },
  );

  // 제스처가 시작되면 기간 선택 해제
  useAnimatedReaction(
    () => transform.panActive.get() || transform.zoomActive.get(),
    (active, prev) => {
      if (active && !prev) scheduleOnRN(setPeriod, null);
    },
  );

  // UI 스레드 프레임 간격으로 1초마다 평균 FPS와 가장 긴 프레임을 잰다.
  const frameStats = useSharedValue({ frames: 0, elapsed: 0, worst: 0 });
  useFrameCallback(({ timeSincePreviousFrame }) => {
    if (timeSincePreviousFrame == null) return;
    const s = frameStats.get();
    s.frames += 1;
    s.elapsed += timeSincePreviousFrame;
    s.worst = Math.max(s.worst, timeSincePreviousFrame);
    if (s.elapsed >= 1000) {
      scheduleOnRN(setFps, {
        avg: Math.round((s.frames * 1000) / s.elapsed),
        worst: Math.round(s.worst),
      });
      frameStats.set({ frames: 0, elapsed: 0, worst: 0 });
    } else {
      frameStats.set(s);
    }
  });

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>
        C-a spike · {bars.length} bars · UI {fps.avg} fps · worst {fps.worst} ms · snaps {snapCount}
      </Text>
      <View style={styles.chart}>
        <CartesianChart
          data={bars}
          xKey="i"
          yKeys={['open', 'high', 'low', 'close']}
          axisOptions={{ axisScales: { yAxisScale: 'log' } }}
          transformState={transform}
          transformConfig={{ pan: { dimensions: 'x' }, pinch: { dimensions: 'x' } }}
          chartPressState={press}
          chartPressConfig={{ pan: { activateAfterLongPress: LONG_PRESS_MS } }}
          // 라이브러리 x축은 끄고 XAxisLayer로 그린다. 아래 여백은 라벨 자리.
          xAxis={{ font: null, lineColor: 'transparent' }}
          padding={{ bottom: 24 }}
          yAxis={[
            {
              font,
              axisSide: 'right',
              labelColor: '#9e9e9e',
              lineColor: '#2a2a2a',
              tickCount: 6,
              enableRescaling: true,
              formatYLabel: (v) => v.toFixed(2),
            },
          ]}
          renderOutside={({ points, chartBounds }) => (
            <>
              <XAxisLayer
                dates={dates}
                chartBounds={chartBounds}
                x0={points.high[0]?.x ?? 0}
                dx={(points.high[1]?.x ?? 0) - (points.high[0]?.x ?? 0)}
                font={font}
                labelColor="#9e9e9e"
                gridColor="#2a2a2a"
              />
              <CrosshairLayer
                press={press}
                transform={transform}
                chartBounds={chartBounds}
                dates={dates}
                font={font}
                color="#bdbdbd"
              />
            </>
          )}
        >
          {({ points, chartBounds }) => (
            <CandleLayer points={points} chartBounds={chartBounds} geom={geom} />
          )}
        </CartesianChart>
      </View>
      <View style={styles.periods}>
        {PERIODS.map((p) => (
          <Pressable
            key={p.label}
            onPress={() => applyPeriod(p.bars)}
            style={[styles.chip, period === p.bars && styles.chipActive]}
          >
            <Text style={styles.chipText}>{p.label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  title: {
    color: '#e0e0e0',
    fontSize: 14,
    padding: 12,
  },
  chart: {
    flex: 1,
  },
  periods: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  chip: {
    width: 50,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1e1e',
  },
  chipActive: {
    backgroundColor: '#3a3a6a',
  },
  chipText: {
    color: '#e0e0e0',
  },
});

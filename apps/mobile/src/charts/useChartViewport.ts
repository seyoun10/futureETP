import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useSharedValue } from 'react-native-reanimated';
import {
  getTransformComponents,
  setScale,
  setTranslate,
  useChartTransformState,
} from 'victory-native';
import type { ChartBounds, PointsArray } from 'victory-native';
import { scheduleOnRN } from 'react-native-worklets';

import { useCrosshairPosition } from './CrosshairLayer';
import type { ChartTransform, CrosshairPress } from './CrosshairLayer';
import { fitTransform, periodTransform, visibleRange } from './fitTransform';
import type { CandleGeom, Transform } from './fitTransform';

const EPSILON = 1e-3;
export const LONG_PRESS_MS = 300;
// 차트 아래 x축 라벨 자리
export const X_LABEL_HEIGHT = 20;

const applyTransform = (state: ChartTransform, t: Transform) => {
  'worklet';
  state.matrix.set(setTranslate(setScale(state.matrix.get(), t.k, t.ky), t.tx, t.ty));
};

export type ChartDetail = { index: number; side: 'left' | 'right' };

type ViewportOptions = {
  press: CrosshairPress;
  // 기간 버튼이 고른 봉 수. 제스처로 범위를 바꾸면 onGestureStart 뒤 null로 받는다
  periodBars: number | null;
  onGestureStart: () => void;
  onVisibleRangeChange?: (i0: number, i1: number) => void;
};

// C-a·C-c 공용 x축 확대·이동(D-056, D-087). x만 핀치·드래그, 보이는 봉 기준 y 자동 맞춤,
// 기간 버튼 범위, 길게 누르기 십자선(봉에 붙을 때 햅틱, 한 번 더 누르면 사라짐), 상세 박스 위치.
export function useChartViewport({
  press,
  periodBars,
  onGestureStart,
  onVisibleRangeChange,
}: ViewportOptions) {
  const { state: transform } = useChartTransformState();
  const geom = useSharedValue<CandleGeom | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [detail, setDetail] = useState<ChartDetail | null>(null);
  const [width, setWidth] = useState(0);
  const widthValue = useSharedValue(0);

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
  const onSnap = useCallback((index: number, side: ChartDetail['side']) => {
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

  return { transform, zoomed, detail, width, onLayout, onGeom, crosshair, hideCrosshairTap };
}

// 변환 전 픽셀 좌표(봉과 선의 위·아래 끝)를 worklet이 읽을 수 있게 넘긴다.
export function useReportGeom(
  hi: PointsArray,
  lo: PointsArray,
  chartBounds: ChartBounds,
  onGeom: (g: CandleGeom) => void,
) {
  useEffect(() => {
    const first = hi[0];
    if (!first) return;
    const second = hi[1];
    onGeom({
      left: chartBounds.left,
      right: chartBounds.right,
      top: chartBounds.top,
      bottom: chartBounds.bottom,
      x0: first.x,
      // 봉이 하나뿐이면 차트 폭을 간격으로 둔다
      dx: second ? second.x - first.x : chartBounds.right - chartBounds.left,
      highY: hi.map((p) => p.y ?? 0),
      lowY: lo.map((p) => p.y ?? 0),
    });
  }, [hi, lo, chartBounds, onGeom]);
}

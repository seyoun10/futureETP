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
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { useCrosshairPosition } from './CrosshairLayer';
import type { ChartTransform, CrosshairPress } from './CrosshairLayer';
import { fitTransform, periodTransform, visibleRange } from './fitTransform';
import type { CandleGeom, Transform } from './fitTransform';

const EPSILON = 1e-3;
export const LONG_PRESS_MS = 300;

const applyTransform = (state: ChartTransform, t: Transform) => {
  'worklet';
  state.matrix.set(setTranslate(setScale(state.matrix.get(), t.k, t.ky), t.tx, t.ty));
};

export type ChartDetail = { index: number; side: 'left' | 'right' };
// 드래그(이동)는 보이는 봉 수가 그대로라 기간 선택 표시를 남기고, 핀치(확대·축소)는 지운다(screens.md C-a)
export type ChartGesture = 'pan' | 'zoom';

type ViewportOptions = {
  press: CrosshairPress;
  // 기간 버튼이 고른 봉 수. 제스처로 범위를 바꾸면 onGestureStart 뒤 null로 받는다
  periodBars: number | null;
  // 제스처가 보이는 범위를 처음 바꿀 때 한 번. 범위 끝에서 더 밀어 그대로면 부르지 않는다
  onGestureStart: (gesture: ChartGesture) => void;
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
  // UI 스레드에서 읽는다. JS 스레드의 set은 UI에 비동기로 반영돼, 바로 뒤 JS의 get이 이전 값(null)을 읽고
  // 기간 맞춤을 건너뛸 수 있다(봉이 많아 UI 스레드가 바쁠 때). 같은 큐라 onGeom의 set 뒤에 실행된다
  useEffect(() => {
    scheduleOnUI(() => {
      'worklet';
      const g = geom.get();
      if (!g) return;
      if (periodBars !== null) {
        applyTransform(transform, periodTransform(g, periodBars));
      } else {
        const c = getTransformComponents(transform.matrix.get());
        applyTransform(transform, fitTransform(g, c.scaleX, c.translateX));
      }
    });
  }, [geom, geomVersion, periodBars, transform]);

  // 진행 중인 제스처와 시작 때의 x 배율·이동. 범위를 바꾸면 알리고 비운다
  const pending = useSharedValue<{ gesture: ChartGesture; k: number; tx: number } | null>(null);

  // 제스처가 행렬을 바꿀 때마다 x 범위 제한 + y 자동 맞춤(UI 스레드, D-056)
  useAnimatedReaction(
    () => transform.matrix.get(),
    (m) => {
      const g = geom.get();
      if (!g) return;
      const c = getTransformComponents(m);
      const t = fitTransform(g, c.scaleX, c.translateX);
      // 제한한 뒤의 값으로 비교한다. 끝에서 더 밀면 제한이 시작 위치로 되돌려 보이는 범위가 그대로다
      const p = pending.get();
      if (p && (Math.abs(t.k - p.k) > EPSILON || Math.abs(t.tx - p.tx) > EPSILON)) {
        pending.set(null);
        scheduleOnRN(onGestureStart, p.gesture);
      }
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

  // 제스처가 시작되면 시작 위치를 기억하고, 범위가 실제로 바뀔 때 알린다(위 반응).
  // 받는 쪽은 기간 맞춤을 멈추고, 선택 표시는 핀치일 때만 지운다(screens.md C-a)
  const onGestureActive = (gesture: ChartGesture, active: boolean, prev: boolean | null) => {
    'worklet';
    if (active && !prev) {
      const p = pending.get();
      if (p) {
        // 드래그와 핀치가 겹치면 핀치로 알린다
        if (gesture === 'zoom') pending.set({ ...p, gesture });
        return;
      }
      const c = getTransformComponents(transform.matrix.get());
      pending.set({ gesture, k: c.scaleX, tx: c.translateX });
    } else if (!active && !transform.panActive.get() && !transform.zoomActive.get()) {
      pending.set(null);
    }
  };
  useAnimatedReaction(
    () => transform.panActive.get(),
    (active, prev) => onGestureActive('pan', active, prev),
  );
  useAnimatedReaction(
    () => transform.zoomActive.get(),
    (active, prev) => onGestureActive('zoom', active, prev),
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

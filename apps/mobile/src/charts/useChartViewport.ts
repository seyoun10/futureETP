import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useAnimatedReaction, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import {
  getTransformComponents,
  setScale,
  setTranslate,
  useChartTransformState,
} from 'victory-native';
import type { ChartBounds, PointsArray } from 'victory-native';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { PERF_ENABLED, perfMark } from '@/lib/perfLog';

import type { OverlayInsets } from './ChartOverlay';
import { useCrosshairPosition } from './CrosshairLayer';
import type { ChartTransform, CrosshairPress } from './CrosshairLayer';
import {
  fitTransform,
  periodTransform,
  pinchTransform,
  shiftedView,
  visibleRange,
} from './fitTransform';
import type { CandleGeom, PinchStart, Transform } from './fitTransform';

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
  // 기간 버튼이 고른 봉 수. 제스처로 범위를 바꾸면 onViewChange 뒤 null로 받는다
  periodBars: number | null;
  // 제스처가 보이는 범위를 기간 범위에서 벗어나게 하면 그 제스처로, 다시 기간 범위(최근 끝)로
  // 돌아오면 null로 부른다. 범위 끝에서 더 밀어 그대로면 부르지 않는다
  onViewChange: (gesture: ChartGesture | null) => void;
  onVisibleRangeChange?: (i0: number, i1: number) => void;
  // 차트 안에 겹친 정보 줄 높이. y 자동 맞춤이 이만큼 위·아래를 비워 봉·선이 글자 밑으로 들어가지 않는다
  dataInsets?: OverlayInsets;
};

const NO_INSETS: OverlayInsets = { top: 0, bottom: 0 };

// C-a·C-c 공용 x축 확대·이동(D-056, D-087). x만 핀치·드래그, 보이는 봉 기준 y 자동 맞춤,
// 기간 버튼 범위, 길게 누르기 십자선(봉에 붙을 때 햅틱, 한 번 더 누르면 사라짐), 상세 박스 위치.
// 핀치·드래그는 라이브러리 것을 끄고 여기서 만든다(gestures). 라이브러리 핀치는 손가락 가운데를 변환 전
// 좌표로 써서 확대된 상태에서 고정점이 어긋나고, 함께 도는 드래그가 행렬을 덮어써 시점이 튄다.
export function useChartViewport({
  press,
  periodBars,
  onViewChange,
  onVisibleRangeChange,
  dataInsets = NO_INSETS,
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
  // 마지막으로 맞춘 기간의 봉 수. 제스처 뒤 이 기간의 최근 위치로 돌아왔는지 볼 때 쓴다
  const homeBars = useSharedValue(0);
  // 첫 맞춤 전에는 행렬이 기본값(전체 봉)이라 화면 진입 때 전체 기간이 몇 프레임 보인다. 맞출 때까지 감춘다
  const fitted = useSharedValue(false);
  // 핀치 시작 때 배율·이동·손가락 가운데(아래 gestures). 과거 봉이 앞에 붙으면 같이 옮긴다
  const pinchStart = useSharedValue<PinchStart>({ k: 1, tx: 0, focalX: 0 });
  // 받은 좌표의 위·아래를 정보 줄 높이만큼 줄여 둔다(fitTransform은 이 범위에 맞춘다). 높이가 바뀌면 원래 좌표로 다시 줄인다
  const rawGeom = useRef<{ g: CandleGeom; span: DateSpan } | null>(null);
  const insets = useRef(dataInsets);
  // 좌표 교체와 (과거 봉이 앞에 붙었을 때) 보던 날짜 범위 유지를 UI 스레드의 한 작업에서 한다(D-104).
  // 나눠 하면 그 사이 새 좌표에 이전 행렬이 걸려 보이는 범위가 튀고, 첫 봉이 보인다고 잘못 알려 연달아 받는다
  const applyGeom = useCallback(
    (g: CandleGeom, ins: OverlayInsets, shift: number) => {
      const next = { ...g, top: g.top + ins.top, bottom: g.bottom - ins.bottom };
      scheduleOnUI(() => {
        'worklet';
        const prev = geom.get();
        geom.set(next);
        if (shift <= 0 || !prev || !fitted.get()) return;
        const c = getTransformComponents(transform.matrix.get());
        const view = shiftedView(prev, next, shift, c.scaleX, c.translateX);
        applyTransform(transform, fitTransform(next, view.k, view.tx));
        if (transform.zoomActive.get()) {
          const start = pinchStart.get();
          pinchStart.set({ ...start, ...shiftedView(prev, next, shift, start.k, start.tx) });
        }
      });
      setGeomVersion((v) => v + 1);
    },
    [fitted, geom, pinchStart, transform],
  );
  const onGeom = useCallback(
    (g: CandleGeom, span: DateSpan) => {
      const prev = rawGeom.current;
      // 앞에 붙은 봉 수. 첫 날짜가 앞당겨지고 마지막 날짜가 같을 때만이다(새로고침으로 오늘 봉이 붙는 경우와 구분)
      const shift =
        prev && span.first < prev.span.first && span.last === prev.span.last
          ? g.highY.length - prev.g.highY.length
          : 0;
      rawGeom.current = { g, span };
      applyGeom(g, insets.current, shift);
    },
    [applyGeom],
  );
  const { top: insetTop, bottom: insetBottom } = dataInsets;
  useEffect(() => {
    insets.current = { top: insetTop, bottom: insetBottom };
    if (rawGeom.current) applyGeom(rawGeom.current.g, insets.current, 0);
  }, [applyGeom, insetTop, insetBottom]);
  const reportFit = PERF_ENABLED ? perfMark : null;
  const fittedStyle = useAnimatedStyle(() => ({ opacity: fitted.get() ? 1 : 0 }));
  // UI 스레드에서 읽는다. JS 스레드의 set은 UI에 비동기로 반영돼, 바로 뒤 JS의 get이 이전 값(null)을 읽고
  // 기간 맞춤을 건너뛸 수 있다(봉이 많아 UI 스레드가 바쁠 때). 같은 큐라 onGeom의 set 뒤에 실행된다
  useEffect(() => {
    scheduleOnUI(() => {
      'worklet';
      const g = geom.get();
      if (!g) return;
      if (periodBars !== null) {
        homeBars.set(periodBars);
        applyTransform(transform, periodTransform(g, periodBars));
      } else {
        const c = getTransformComponents(transform.matrix.get());
        applyTransform(transform, fitTransform(g, c.scaleX, c.translateX));
      }
      if (!fitted.get() && reportFit) scheduleOnRN(reportFit, 'chart fitted', true);
      fitted.set(true);
    });
  }, [fitted, geom, geomVersion, homeBars, periodBars, reportFit, transform]);

  // 진행 중인 제스처(드래그·핀치가 겹치면 핀치)와 기간 범위에서 벗어났다고 알린 제스처
  const active = useSharedValue<ChartGesture | null>(null);
  const away = useSharedValue<ChartGesture | null>(null);

  // 제스처가 행렬을 바꿀 때마다 x 범위 제한 + y 자동 맞춤(UI 스레드, D-056)
  useAnimatedReaction(
    () => transform.matrix.get(),
    (m) => {
      const g = geom.get();
      if (!g) return;
      const c = getTransformComponents(m);
      const t = fitTransform(g, c.scaleX, c.translateX);
      // 제한한 뒤의 값을 기간 범위와 비교한다. 끝에서 더 밀면 제한이 되돌려 보이는 범위가 그대로다
      const home = periodTransform(g, homeBars.get());
      const sameK = Math.abs(t.k - home.k) < EPSILON;
      const atHome = sameK && Math.abs(t.tx - home.tx) < EPSILON;
      const gesture = active.get();
      const left = away.get();
      if (atHome) {
        if (left !== null) {
          away.set(null);
          scheduleOnRN(onViewChange, null);
        }
      } else if (gesture !== null && left === null) {
        away.set(gesture);
        scheduleOnRN(onViewChange, gesture);
      } else if (gesture === 'zoom' && left === 'pan' && !sameK) {
        // 드래그로 벗어난 뒤 핀치로 배율까지 바꿨다
        away.set('zoom');
        scheduleOnRN(onViewChange, 'zoom');
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

  // '전체'(k=1)에서는 드래그를 막는다(아래 gestures)
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
  // 첫 맞춤 전(기본 행렬 = 전체 봉)에는 알리지 않는다. 가장 과거 봉이 보인다고 잘못 알려 진입하자마자 과거 데이터를 받았다
  useAnimatedReaction(
    () => {
      const g = geom.get();
      if (!g || !fitted.get()) return null;
      const c = getTransformComponents(transform.matrix.get());
      return visibleRange(g, c.scaleX, c.translateX);
    },
    (range, prev) => {
      if (!range || (prev && range[0] === prev[0] && range[1] === prev[1])) return;
      scheduleOnRN(rangeChanged, range[0], range[1]);
    },
  );

  // 진행 중인 제스처를 기억한다. 범위가 실제로 바뀌거나 돌아올 때 알린다(위 반응).
  // 받는 쪽은 기간 맞춤을 멈추고, 선택 표시는 핀치일 때만 지운다(screens.md C-a)
  useAnimatedReaction(
    () => {
      if (transform.zoomActive.get()) return 'zoom';
      return transform.panActive.get() ? 'pan' : null;
    },
    (gesture) => active.set(gesture),
  );

  // 십자선은 손을 떼도 남고, 차트를 한 번 더 누르면 사라진다(D-056).
  // 십자선이 있는 동안은 드래그를 끄고 길게 누르기 없이 끌면 바로 십자선이 따라온다(pressConfig)
  const crosshairVisible = useSharedValue(false);
  const [crosshairShown, setCrosshairShown] = useState(false);
  useAnimatedReaction(
    () => press.isActive.get(),
    (active) => {
      if (active && !crosshairVisible.get()) {
        crosshairVisible.set(true);
        scheduleOnRN(setCrosshairShown, true);
      }
    },
  );
  const crosshair = useCrosshairPosition(press, transform, crosshairVisible);

  const pressConfig = useMemo(
    () => ({ pan: crosshairShown ? {} : { activateAfterLongPress: LONG_PRESS_MS } }),
    [crosshairShown],
  );

  // 핀치: 시작 때 손가락 가운데 있던 지점이 손가락 가운데를 따라가게 확대·축소한다(두 손가락 이동 포함)
  const gestures = useMemo(() => {
    const hideCrosshair = Gesture.Tap().onEnd(() => {
      crosshairVisible.set(false);
      scheduleOnRN(setCrosshairShown, false);
      scheduleOnRN(setDetail, null);
    });
    const pinch = Gesture.Pinch()
      .onStart((e) => {
        const c = getTransformComponents(transform.matrix.get());
        pinchStart.set({ k: c.scaleX, tx: c.translateX, focalX: e.focalX });
        transform.zoomActive.set(true);
      })
      .onChange((e) => {
        const g = geom.get();
        if (!g) return;
        applyTransform(transform, pinchTransform(g, pinchStart.get(), e.scale, e.focalX));
      })
      .onFinalize(() => transform.zoomActive.set(false));
    // 드래그: '전체'에서는 막는다(이동이 x를 바꾸고 보정이 되돌리는 쓰기 충돌, D-056). 핀치 중에는 핀치가 이동까지 맡는다
    const pan = Gesture.Pan()
      .enabled(zoomed && !crosshairShown)
      .onStart(() => transform.panActive.set(true))
      .onChange((e) => {
        const g = geom.get();
        if (!g || transform.zoomActive.get()) return;
        const c = getTransformComponents(transform.matrix.get());
        applyTransform(transform, fitTransform(g, c.scaleX, c.translateX + e.changeX));
      })
      .onFinalize(() => transform.panActive.set(false));
    return Gesture.Race(hideCrosshair, Gesture.Simultaneous(pinch, pan));
  }, [crosshairVisible, crosshairShown, geom, pinchStart, transform, zoomed]);

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

  return {
    transform,
    detail,
    width,
    onLayout,
    onGeom,
    crosshair,
    gestures,
    pressConfig,
    fittedStyle,
  };
}

// 변환 전 픽셀 좌표(봉과 선의 위·아래 끝)를 worklet이 읽을 수 있게 넘긴다.
// 봉 좌표가 어느 날짜 구간인지(과거 봉이 앞에 붙었는지 판단용)
export type DateSpan = { first: string; last: string };

export function useReportGeom(
  hi: PointsArray,
  lo: PointsArray,
  chartBounds: ChartBounds,
  dates: readonly string[],
  onGeom: (g: CandleGeom, span: DateSpan) => void,
) {
  useEffect(() => {
    const first = hi[0];
    if (!first) return;
    const second = hi[1];
    onGeom(
      {
        left: chartBounds.left,
        right: chartBounds.right,
        top: chartBounds.top,
        bottom: chartBounds.bottom,
        x0: first.x,
        // 봉이 하나뿐이면 차트 폭을 간격으로 둔다
        dx: second ? second.x - first.x : chartBounds.right - chartBounds.left,
        highY: hi.map((p) => p.y ?? 0),
        lowY: lo.map((p) => p.y ?? 0),
      },
      { first: dates[0] ?? '', last: dates[dates.length - 1] ?? '' },
    );
  }, [hi, lo, chartBounds, dates, onGeom]);
}

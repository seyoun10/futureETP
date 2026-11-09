import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useGestureFps } from './useGestureFps';
import type { ChartTransform, CrosshairPress } from './CrosshairLayer';
import {
  fitTransform,
  periodTransform,
  pinchTransform,
  shiftedView,
  visibleRange,
} from './fitTransform';
import type { CandleGeom, PinchStart, Transform } from './fitTransform';
import { nextAway, prependedBars, sameTransform, sameX } from './viewportChange';
import type { ChartGesture, DateSpan } from './viewportChange';

export type { ChartGesture, DateSpan };

const EPSILON = 1e-3;
export const LONG_PRESS_MS = 300;

const applyTransform = (state: ChartTransform, t: Transform) => {
  'worklet';
  state.matrix.set(setTranslate(setScale(state.matrix.get(), t.k, t.ky), t.tx, t.ty));
};

// x·view는 봉에 붙을 때 십자선의 화면 x와 변환 행렬 값(상세 박스 위치 계산용, useDetailPlacement)
export type ChartView = { scaleX: number; translateX: number; scaleY: number; translateY: number };
export type ChartDetail = { index: number; x: number; view: ChartView };

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
  // 과거 데이터를 받는 동안 true. 진행 중인 핀치·드래그를 취소한다. 새 터치는 차트가 pointerEvents로 막는다(D-108)
  locked?: boolean;
};

const NO_INSETS: OverlayInsets = { top: 0, bottom: 0 };

// C-a·C-c 공용 x축 확대·이동(D-056, D-087). x만 핀치·드래그, 보이는 봉 기준 y 자동 맞춤,
// 기간 버튼 범위, 길게 누르기 십자선(봉에 붙을 때 햅틱, 한 번 더 누르면 사라짐), 상세 박스에 보일 봉.
// 핀치·드래그는 라이브러리 것을 끄고 여기서 만든다(gestures). 라이브러리 핀치는 손가락 가운데를 변환 전
// 좌표로 써서 확대된 상태에서 고정점이 어긋나고, 함께 도는 드래그가 행렬을 덮어써 시점이 튄다.
export function useChartViewport({
  press,
  periodBars,
  onViewChange,
  onVisibleRangeChange,
  dataInsets = NO_INSETS,
  locked = false,
}: ViewportOptions) {
  // victory의 useChartTransformState는 렌더링마다 새 state 객체(panActive·zoomActive도 새 값)를 돌려준다.
  // 첫 값으로 고정해야 이 값에 의존하는 콜백·effect가 렌더링마다 다시 돌지 않는다(onGeom → setGeomVersion 무한 반복)
  const { state: transformState } = useChartTransformState();
  const [transform] = useState(transformState);
  const geom = useSharedValue<CandleGeom | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [detail, setDetail] = useState<ChartDetail | null>(null);

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
  // 좌표 교체와 (과거 봉이 앞에 붙거나 회전으로 폭이 바뀌었을 때) 보던 날짜 범위 유지를 UI 스레드의 한 작업에서 한다(D-104).
  // 나눠 하면 그 사이 새 좌표에 이전 행렬이 걸려 보이는 범위가 튀고, 첫 봉이 보인다고 잘못 알려 연달아 받는다
  // 측정 로그(dev 변형). worklet에서 JS로 넘겨 부른다
  const reportFit = PERF_ENABLED ? perfMark : null;
  const applyGeom = useCallback(
    (g: CandleGeom, ins: OverlayInsets, shift: number) => {
      const next = { ...g, top: g.top + ins.top, bottom: g.bottom - ins.bottom };
      scheduleOnUI(() => {
        'worklet';
        const prev = geom.get();
        geom.set(next);
        // 회전으로 폭이 바뀌어도(shift 0) 보던 봉 범위를 유지한다. 행렬의 이동은 픽셀 값이라 그대로 두면
        // 폭이 넓어질 때 과거 쪽으로 밀린다. 기간 버튼 상태면 뒤의 기간 맞춤이 최근 봉으로 다시 맞춘다.
        // x 좌표가 그대로면(정보 줄 높이만 바뀜·같은 좌표 재보고) 행렬을 건드리지 않는다. 행렬을 바꾸면
        // 차트가 다시 그려지며 좌표를 또 보고해 끝없이 반복된다
        if (!prev || !fitted.get() || sameX(prev, next)) return;
        const c = getTransformComponents(transform.matrix.get());
        const view = shiftedView(prev, next, shift, c.scaleX, c.translateX);
        applyTransform(transform, fitTransform(next, view.k, view.tx));
        if (shift > 0 && reportFit) scheduleOnRN(reportFit, `view kept +${shift} bars`, true);
        if (transform.zoomActive.get()) {
          const start = pinchStart.get();
          pinchStart.set({ ...start, ...shiftedView(prev, next, shift, start.k, start.tx) });
        }
      });
      setGeomVersion((v) => v + 1);
    },
    [fitted, geom, pinchStart, reportFit, transform],
  );
  const onGeom = useCallback(
    (g: CandleGeom, span: DateSpan) => {
      const prev = rawGeom.current;
      const shift = prependedBars(
        prev && { barCount: prev.g.highY.length, span: prev.span },
        g.highY.length,
        span,
      );
      rawGeom.current = { g, span };
      if (shift > 0) perfMark(`geometry +${shift} bars`);
      applyGeom(g, insets.current, shift);
    },
    [applyGeom],
  );
  const { top: insetTop, bottom: insetBottom } = dataInsets;
  useEffect(() => {
    insets.current = { top: insetTop, bottom: insetBottom };
    if (rawGeom.current) applyGeom(rawGeom.current.g, insets.current, 0);
  }, [applyGeom, insetTop, insetBottom]);
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
  // 제스처 중 프레임 측정(dev 변형만 찍는다)
  useGestureFps(active);

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
      const next = nextAway(t, home, active.get(), away.get());
      if (next !== undefined) {
        away.set(next);
        scheduleOnRN(onViewChange, next);
      }
      const current = { k: c.scaleX, tx: c.translateX, ky: c.scaleY, ty: c.translateY };
      if (!sameTransform(t, current)) applyTransform(transform, t);
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
  // 차트 밖 버튼(되돌리기)에서 지울 때. 차트 안 탭은 아래 hideCrosshair 제스처가 UI 스레드에서 지운다
  const hideCrosshair = useCallback(() => {
    crosshairVisible.set(false);
    setCrosshairShown(false);
    setDetail(null);
  }, [crosshairVisible]);
  // 기간 칩·되돌리기로 기간 범위에 다시 맞출 때도 지운다. 제스처로 바꾼 범위(null)에서는 남긴다.
  // 상태는 렌더링 중에 이전 값과 비교해 바로 고치고(effect에서 고치면 한 번 더 그린다), UI 스레드 값은 effect에서 고친다
  const [fitBars, setFitBars] = useState(periodBars);
  if (periodBars !== fitBars) {
    setFitBars(periodBars);
    if (periodBars !== null) {
      setCrosshairShown(false);
      setDetail(null);
    }
  }
  useEffect(() => {
    if (periodBars !== null) crosshairVisible.set(false);
  }, [crosshairVisible, periodBars]);

  const pressConfig = useMemo(
    () => ({ pan: crosshairShown ? {} : { activateAfterLongPress: LONG_PRESS_MS } }),
    [crosshairShown],
  );

  // 핀치: 시작 때 손가락 가운데 있던 지점이 손가락 가운데를 따라가게 확대·축소한다(두 손가락 이동 포함)
  const gestures = useMemo(() => {
    const hideCrosshair = Gesture.Tap()
      .enabled(!locked)
      .onEnd(() => {
        crosshairVisible.set(false);
        scheduleOnRN(setCrosshairShown, false);
        scheduleOnRN(setDetail, null);
      });
    const pinch = Gesture.Pinch()
      .enabled(!locked)
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
      .enabled(zoomed && !crosshairShown && !locked)
      .onStart(() => transform.panActive.set(true))
      .onChange((e) => {
        const g = geom.get();
        if (!g || transform.zoomActive.get()) return;
        const c = getTransformComponents(transform.matrix.get());
        applyTransform(transform, fitTransform(g, c.scaleX, c.translateX + e.changeX));
      })
      .onFinalize(() => transform.panActive.set(false));
    return Gesture.Race(hideCrosshair, Gesture.Simultaneous(pinch, pan));
  }, [crosshairVisible, crosshairShown, geom, locked, pinchStart, transform, zoomed]);

  // 봉에 붙을 때마다 햅틱 + 상세 박스 갱신
  const onSnap = useCallback((index: number, x: number, view: ChartView) => {
    setDetail({ index, x, view });
    void Haptics.selectionAsync();
  }, []);
  useAnimatedReaction(
    () => (press.isActive.get() ? press.matchedIndex.get() : -1),
    (idx, prev) => {
      if (idx < 0 || idx === prev) return;
      const x = crosshair.x.get();
      const { scaleX, translateX, scaleY, translateY } = getTransformComponents(
        transform.matrix.get(),
      );
      scheduleOnRN(onSnap, idx, x, {
        scaleX,
        translateX,
        scaleY,
        translateY,
      });
    },
  );

  return {
    transform,
    detail,
    onGeom,
    crosshair,
    hideCrosshair,
    gestures,
    pressConfig,
    fittedStyle,
  };
}

// 변환 전 픽셀 좌표(봉과 선의 위·아래 끝)를 worklet이 읽을 수 있게 넘긴다.
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

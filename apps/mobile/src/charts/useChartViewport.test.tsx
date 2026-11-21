import { act, render, renderHook } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { makeMutable } from 'react-native-reanimated';
import type { ChartBounds, PointsArray } from 'victory-native';
import type { CrosshairPress } from './CrosshairLayer';
import {
  fitTransform,
  periodTransform,
  pinchTransform,
  shiftedView,
  visibleRange,
} from './fitTransform';
import type { CandleGeom, Transform } from './fitTransform';
import { useChartViewport, useReportGeom } from './useChartViewport';

// Reanimated·Worklets 네이티브 모듈은 Jest에서 초기화되지 않는다(라이브러리 Jest mock도 CSS 초기화에서 멈춘다).
// 이 hook이 쓰는 것만 둔다: 공유 값은 get·set 객체, UI 스레드 작업은 바로 실행.
// 애니메이션 반응은 등록만 하고 테스트가 runReactions()로 돌린다(이전 값은 반응마다 기억)
type Reaction = {
  prepare: () => unknown;
  react: (v: unknown, prev: unknown) => void;
  prev: unknown;
};
const reactions: Reaction[] = [];
const runReactions = () =>
  reactions.forEach((r) => {
    const value = r.prepare();
    r.react(value, r.prev);
    r.prev = value;
  });
jest.mock('react-native-worklets', () => ({
  scheduleOnUI: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args),
  scheduleOnRN: (fn: (...a: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));
jest.mock('react-native-reanimated', () => {
  const { useRef, useState } = jest.requireActual<typeof import('react')>('react');
  const makeMutable = <T,>(initial: T) => {
    let value = initial;
    return { get: () => value, set: (v: T) => (value = v) };
  };
  return {
    makeMutable,
    useSharedValue: <T,>(initial: T) => useState(() => makeMutable(initial))[0],
    useDerivedValue: <T,>(fn: () => T) => makeMutable(fn()),
    useAnimatedReaction: (prepare: Reaction['prepare'], react: Reaction['react']) => {
      const entry = useRef<Reaction | null>(null);
      if (!entry.current) {
        entry.current = { prepare, react, prev: null };
        reactions.push(entry.current);
      }
      entry.current.prepare = prepare;
      entry.current.react = react;
    },
    // 스타일은 렌더링 때 한 번 계산한다(공유 값이 바뀌면 다시 렌더링해야 반영된다)
    useAnimatedStyle: <T,>(fn: () => T) => fn(),
    useFrameCallback: () => ({ setActive: () => undefined }),
  };
});

// Gesture Handler도 네이티브 바인딩이 없다. 제스처는 종류·enabled·핸들러를 기록하고 자기를 돌려주는 객체로,
// 합성(Race·Simultaneous)은 자식 목록으로 둔다. 테스트가 핸들러를 직접 부른다
type MockHandler = (e?: unknown) => void;
type MockGesture = {
  kind: string;
  isEnabled: boolean;
  handlers: Record<string, MockHandler>;
  children: MockGesture[];
};
jest.mock('react-native-gesture-handler', () => {
  const make = (kind: string, children: MockGesture[] = []) => {
    const g: MockGesture = { kind, isEnabled: true, handlers: {}, children };
    return new Proxy(g, {
      get: (target, prop: string, receiver: unknown) => {
        if (prop in target) return target[prop as keyof MockGesture];
        return (arg: unknown) => {
          if (prop === 'enabled') target.isEnabled = arg as boolean;
          else target.handlers[prop] = arg as MockHandler;
          return receiver;
        };
      },
    });
  };
  return {
    Gesture: new Proxy(
      {},
      {
        get:
          (_t, kind: string) =>
          (...children: MockGesture[]) =>
            make(kind, children),
      },
    ),
  };
});

jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));

// Skia는 Jest에서 돌지 않는다. 이 hook은 CrosshairLayer의 위치 계산만 쓰고 그리지 않는다
jest.mock('@shopify/react-native-skia', () => ({}));

// 실제 victory-native처럼 useChartTransformState가 렌더링마다 새 state 객체(panActive·zoomActive도 새 값)를
// 돌려준다. 행렬은 x·y 배율·이동만 담은 객체로 둔다
type MockMatrix = Transform;
jest.mock('victory-native', () => {
  const { useSharedValue, makeMutable: mutable } =
    jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated');
  return {
    useChartTransformState: () => {
      const matrix = useSharedValue<MockMatrix>({ k: 1, tx: 0, ky: 1, ty: 0 });
      const offset = useSharedValue<MockMatrix>({ k: 1, tx: 0, ky: 1, ty: 0 });
      const origin = useSharedValue({ x: 0, y: 0 });
      return {
        state: { panActive: mutable(false), zoomActive: mutable(false), origin, matrix, offset },
      };
    },
    getTransformComponents: (m: MockMatrix) => ({
      scaleX: m.k,
      scaleY: m.ky,
      translateX: m.tx,
      translateY: m.ty,
    }),
    setScale: (m: MockMatrix, k: number, ky: number) => ({ ...m, k, ky }),
    setTranslate: (m: MockMatrix, tx: number, ty: number) => ({ ...m, tx, ty }),
  };
});

const press = {
  isActive: makeMutable(false),
  matchedIndex: makeMutable(-1),
  x: { value: makeMutable(0), position: makeMutable(0) },
  y: { close: { value: makeMutable(0), position: makeMutable(0) } },
} as unknown as CrosshairPress;

const DATA_A: readonly unknown[] = [{ i: 0 }, { i: 1 }, { i: 2 }];

const options = {
  press,
  periodBars: 2,
  data: DATA_A,
  onViewChange: () => undefined,
};

const BOUNDS: ChartBounds = { left: 0, right: 300, top: 0, bottom: 200 };
const HI: PointsArray = [0, 1, 2].map((i) => ({ x: i * 100, xValue: i, y: 50, yValue: 0 }));
const LO: PointsArray = [0, 1, 2].map((i) => ({ x: i * 100, xValue: i, y: 150, yValue: 0 }));
const DATES = ['2026-10-28', '2026-10-29', '2026-10-30'];

beforeEach(() => {
  reactions.length = 0;
  press.isActive.set(false);
  press.matchedIndex.set(-1);
  press.x.position.set(0);
  jest.clearAllMocks();
});

type Options = Parameters<typeof useChartViewport>[0];

// 폭 600px에 봉 n개(간격 일정). 고가·저가는 봉마다 달라 y 맞춤이 보이는 범위를 따라 바뀐다
function geomOf(n: number, yOffset = 0): CandleGeom {
  const dx = 600 / n;
  const highY = Array.from({ length: n }, (_, i) => 40 + ((i * 7) % 30) + yOffset);
  return {
    left: 0,
    right: 600,
    top: 0,
    bottom: 200,
    x0: dx / 2,
    dx,
    highY,
    lowY: highY.map((h, i) => h + 50 + (i % 5) * 4),
  };
}
const G60 = geomOf(60);
const SPAN = { first: '2026-01-02', last: '2026-03-27' };

const expectTransform = (actual: Transform, expected: Transform) => {
  expect(actual.k).toBeCloseTo(expected.k, 6);
  expect(actual.tx).toBeCloseTo(expected.tx, 6);
  expect(actual.ky).toBeCloseTo(expected.ky, 6);
  expect(actual.ty).toBeCloseTo(expected.ty, 6);
};

async function setup(props: Partial<Options> = {}) {
  const onViewChange = jest.fn();
  const onVisibleRangeChange = jest.fn();
  const hook = await renderHook(
    (p: Partial<Options>) =>
      useChartViewport({ ...options, onViewChange, onVisibleRangeChange, ...props, ...p }),
    { initialProps: {} },
  );
  const { result } = hook;
  const matrix = () => result.current.transform.matrix.get() as unknown as Transform;
  const setMatrix = (m: Transform) => result.current.transform.matrix.set(m as never);
  const report = (g: CandleGeom, span = SPAN) => act(() => result.current.onGeom(g, span));
  const react = () => act(runReactions);
  const gestures = () => {
    const race = result.current.gestures as unknown as MockGesture;
    const [tap, both] = race.children;
    const [pinch, pan] = both!.children;
    return { tap: tap!, pinch: pinch!, pan: pan! };
  };
  return {
    ...hook,
    onViewChange,
    onVisibleRangeChange,
    matrix,
    setMatrix,
    report,
    react,
    gestures,
  };
}

describe('useChartViewport', () => {
  it('다시 렌더링해도 onGeom은 같은 참조다', async () => {
    const { result, rerender } = await renderHook(() => useChartViewport(options));
    const first = result.current.onGeom;
    await rerender({});
    expect(result.current.onGeom).toBe(first);
  });

  // 반복되면 React가 멈추지 않고 계속 돈다(passive effect). 한도를 넘으면 렌더링 중에 던져 실패로 끝낸다
  it('봉 좌표를 보고해도 렌더링이 반복되지 않는다', async () => {
    let renders = 0;
    function Harness() {
      renders += 1;
      if (renders > 20) throw new Error('render loop');
      const viewport = useChartViewport(options);
      const bounds = useMemo(() => BOUNDS, []);
      useReportGeom(HI, LO, bounds, DATES, viewport.onGeom);
      return null;
    }
    await render(<Harness />);
    expect(renders).toBeLessThan(10);
  });

  // victory는 data가 바뀌면 누름 상태를 리셋한다. 훅이 십자선·상세 박스를 남기면 옛 순번으로 다른 봉을 가리켰다
  it('data가 바뀌면 십자선과 상세 박스를 지운다', async () => {
    const { result, rerender } = await renderHook(
      ({ data }: { data: readonly unknown[] }) => useChartViewport({ ...options, data }),
      { initialProps: { data: DATA_A } },
    );
    press.isActive.set(true);
    press.matchedIndex.set(1);
    await act(runReactions);
    expect(result.current.detail?.index).toBe(1);
    expect(result.current.pressConfig.pan).toEqual({});

    // 같은 data로 다시 그리면 남는다
    await rerender({ data: DATA_A });
    expect(result.current.detail?.index).toBe(1);

    // 과거 봉이 앞에 붙은 새 배열
    await rerender({ data: [{ i: 0 }, ...DATA_A] });
    expect(result.current.detail).toBeNull();
    expect(result.current.pressConfig.pan).toEqual({ activateAfterLongPress: 300 });

    // victory가 리셋한 뒤 다시 누르면 새 십자선이 뜬다(숨김 상태였다)
    press.isActive.set(false);
    await act(runReactions);
    press.isActive.set(true);
    press.matchedIndex.set(2);
    await act(runReactions);
    expect(result.current.detail?.index).toBe(2);
    expect(result.current.pressConfig.pan).toEqual({});
  });
});

describe('useChartViewport 맞춤', () => {
  it('봉 좌표를 받으면 마지막 periodBars개 봉에 맞추고, 그 뒤에야 차트를 보인다', async () => {
    const v = await setup({ periodBars: 20 });
    expect(v.result.current.fittedStyle).toEqual({ opacity: 0 });
    expect(v.result.current.fittingStyle).toEqual({ opacity: 1 });

    await v.report(G60);
    expectTransform(v.matrix(), periodTransform(G60, 20));
    await v.rerender({});
    expect(v.result.current.fittedStyle).toEqual({ opacity: 1 });
    expect(v.result.current.fittingStyle).toEqual({ opacity: 0 });
  });

  it('정보 줄 높이만큼 위·아래를 비워 맞추고, 높이가 바뀌면 원래 좌표로 다시 맞춘다', async () => {
    const v = await setup({ periodBars: 20, dataInsets: { top: 20, bottom: 10 } });
    await v.report(G60);
    expectTransform(v.matrix(), periodTransform({ ...G60, top: 20, bottom: 190 }, 20));

    await v.rerender({ dataInsets: { top: 0, bottom: 30 } });
    expectTransform(v.matrix(), periodTransform({ ...G60, top: 0, bottom: 170 }, 20));
  });

  it('기간을 바꾸면 새 기간으로 다시 맞춘다', async () => {
    const v = await setup({ periodBars: 20 });
    await v.report(G60);
    await v.rerender({ periodBars: 40 });
    expectTransform(v.matrix(), periodTransform(G60, 40));
  });

  it('기간이 없으면(제스처로 고른 범위) 새 좌표에 지금 배율·이동을 두고 y만 다시 맞춘다', async () => {
    const v = await setup({ periodBars: 20 });
    await v.report(G60);
    await v.rerender({ periodBars: null });
    v.setMatrix({ k: 2, tx: -300, ky: 1, ty: 0 });

    const shiftedY = geomOf(60, 25);
    await v.report(shiftedY);
    expectTransform(v.matrix(), fitTransform(shiftedY, 2, -300));
  });

  it('과거 봉이 앞에 붙으면 보던 날짜 범위를 유지한다(D-104)', async () => {
    const v = await setup({ periodBars: null });
    await v.report(G60);
    v.setMatrix(fitTransform(G60, 2, -600));

    const g70 = geomOf(70);
    await v.report(g70, { first: '2025-12-01', last: SPAN.last });
    const view = shiftedView(G60, g70, 10, 2, -600);
    expectTransform(v.matrix(), fitTransform(g70, view.k, view.tx));
  });

  it('새로고침으로 오늘 봉이 붙으면(마지막 날짜가 바뀜) 앞에 붙은 봉으로 세지 않는다', async () => {
    const v = await setup({ periodBars: null });
    await v.report(G60);
    v.setMatrix(fitTransform(G60, 2, -600));

    const g61 = geomOf(61);
    await v.report(g61, { first: SPAN.first, last: '2026-03-30' });
    const view = shiftedView(G60, g61, 0, 2, -600);
    expectTransform(v.matrix(), fitTransform(g61, view.k, view.tx));
  });

  it('첫 맞춤 전에 과거 봉이 붙으면 기본 행렬(전체 봉)을 옮기지 않는다', async () => {
    const v = await setup({ periodBars: null });
    const g70 = geomOf(70);
    await act(() => {
      v.result.current.onGeom(G60, SPAN);
      v.result.current.onGeom(g70, { first: '2025-12-01', last: SPAN.last });
    });
    expectTransform(v.matrix(), fitTransform(g70, 1, 0));
  });

  it('핀치 중에 과거 봉이 붙으면 핀치 시작 배율·이동도 같이 옮긴다', async () => {
    const v = await setup({ periodBars: null });
    await v.report(G60);
    v.setMatrix(fitTransform(G60, 2, -600));
    await act(() => v.gestures().pinch.handlers.onStart!({ focalX: 300 }));

    const g70 = geomOf(70);
    await v.report(g70, { first: '2025-12-01', last: SPAN.last });
    const start = { focalX: 300, ...shiftedView(G60, g70, 10, 2, -600) };
    await act(() => v.gestures().pinch.handlers.onChange!({ scale: 1, focalX: 300 }));
    expectTransform(v.matrix(), pinchTransform(g70, start, 1, 300));
  });
});

describe('useChartViewport 행렬 반응', () => {
  it('행렬이 범위를 벗어나면 제한하고 y를 보이는 봉에 맞춘다', async () => {
    const v = await setup({ periodBars: 20 });
    await v.report(G60);
    v.setMatrix({ k: 0.5, tx: 100, ky: 1, ty: 0 });
    await v.react();
    expectTransform(v.matrix(), fitTransform(G60, 0.5, 100));
    expect(v.matrix().k).toBe(1);
  });

  // 최대 확대(20봉)보다 넓은 기간이어야 마지막으로 맞춘 기간을 기억하는지 드러난다
  it('드래그로 기간 범위를 벗어나면 pan, 돌아오면 null을 한 번씩 알린다', async () => {
    const v = await setup({ periodBars: 30 });
    await v.report(G60);
    const home = periodTransform(G60, 30);
    v.result.current.transform.panActive.set(true);
    await v.react();
    expect(v.onViewChange).not.toHaveBeenCalled();

    v.setMatrix(fitTransform(G60, home.k, home.tx + 100));
    await v.react();
    await v.react();
    expect(v.onViewChange.mock.calls).toEqual([['pan']]);

    v.setMatrix(home);
    await v.react();
    expect(v.onViewChange.mock.calls).toEqual([['pan'], [null]]);
  });

  it('최근 끝에서 더 밀어 제한이 되돌리면 알리지 않는다', async () => {
    const v = await setup({ periodBars: 20 });
    await v.report(G60);
    const home = periodTransform(G60, 20);
    v.result.current.transform.panActive.set(true);
    await v.react();
    v.setMatrix({ ...home, tx: home.tx - 300 });
    await v.react();
    expect(v.onViewChange).not.toHaveBeenCalled();
    expectTransform(v.matrix(), home);
  });

  it('보이는 봉 범위는 첫 맞춤 뒤에, 바뀔 때만 알린다', async () => {
    const v = await setup({ periodBars: 20 });
    await v.react();
    expect(v.onVisibleRangeChange).not.toHaveBeenCalled();
    // 좌표는 받았지만 맞추기 전(기본 행렬 = 전체 봉)에는 가장 과거 봉이 보인다고 알리지 않는다
    await act(() => {
      v.result.current.onGeom(G60, SPAN);
      runReactions();
    });
    expect(v.onVisibleRangeChange).not.toHaveBeenCalled();

    await v.report(G60);
    await v.react();
    const home = periodTransform(G60, 20);
    expect(v.onVisibleRangeChange.mock.calls).toEqual([visibleRange(G60, home.k, home.tx)]);
    await v.react();
    expect(v.onVisibleRangeChange).toHaveBeenCalledTimes(1);

    v.setMatrix(fitTransform(G60, home.k, home.tx + 200));
    await v.react();
    expect(v.onVisibleRangeChange).toHaveBeenLastCalledWith(
      ...visibleRange(G60, home.k, home.tx + 200),
    );
  });

  it('onVisibleRangeChange가 없어도 범위 반응이 던지지 않는다', async () => {
    const { result } = await renderHook(() => useChartViewport(options));
    await act(() => result.current.onGeom(G60, SPAN));
    await act(runReactions);
    expect(result.current.transform.matrix.get()).toBeDefined();
  });
});

describe('useChartViewport 제스처', () => {
  it("'전체'(k=1)에서는 드래그를 막고 확대하면 연다. 십자선이 있거나 잠기면 막는다", async () => {
    const v = await setup({ periodBars: null });
    await v.report(G60);
    await v.react();
    expect(v.gestures().pan.isEnabled).toBe(false);
    expect(v.gestures().pinch.isEnabled).toBe(true);
    expect(v.gestures().tap.isEnabled).toBe(true);

    v.setMatrix(fitTransform(G60, 2, -300));
    await v.react();
    expect(v.gestures().pan.isEnabled).toBe(true);

    press.isActive.set(true);
    await v.react();
    expect(v.gestures().pan.isEnabled).toBe(false);

    await act(() => v.result.current.hideCrosshair());
    expect(v.gestures().pan.isEnabled).toBe(true);
    await v.rerender({ locked: true });
    expect(v.gestures().pan.isEnabled).toBe(false);
    expect(v.gestures().pinch.isEnabled).toBe(false);
    expect(v.gestures().tap.isEnabled).toBe(false);
  });

  it('핀치는 시작 지점을 손가락 가운데에 두고 확대·축소하고, 끝나면 범위를 다시 알린다', async () => {
    const v = await setup({ periodBars: 20 });
    await v.report(G60);
    await v.react();
    const home = periodTransform(G60, 20);
    const { pinch } = v.gestures();

    await act(() => pinch.handlers.onStart!({ focalX: 300 }));
    expect(v.result.current.transform.zoomActive.get()).toBe(true);
    await act(() => pinch.handlers.onChange!({ scale: 0.6, focalX: 250 }));
    const t = pinchTransform(G60, { k: home.k, tx: home.tx, focalX: 300 }, 0.6, 250);
    expectTransform(v.matrix(), t);

    v.onVisibleRangeChange.mockClear();
    await act(() => pinch.handlers.onEnd!());
    expect(v.onVisibleRangeChange.mock.calls).toEqual([visibleRange(G60, t.k, t.tx)]);
    await act(() => pinch.handlers.onFinalize!());
    expect(v.result.current.transform.zoomActive.get()).toBe(false);
  });

  it('드래그는 x만 옮기고 핀치 중에는 무시한다. 끝나면 범위가 그대로여도 다시 알린다(D-139)', async () => {
    const v = await setup({ periodBars: 20 });
    await v.report(G60);
    await v.react();
    const home = periodTransform(G60, 20);
    const { pan } = v.gestures();

    await act(() => pan.handlers.onStart!());
    expect(v.result.current.transform.panActive.get()).toBe(true);
    await act(() => pan.handlers.onChange!({ changeX: 100 }));
    expectTransform(v.matrix(), fitTransform(G60, home.k, home.tx + 100));

    v.result.current.transform.zoomActive.set(true);
    await act(() => pan.handlers.onChange!({ changeX: 100 }));
    expectTransform(v.matrix(), fitTransform(G60, home.k, home.tx + 100));
    v.result.current.transform.zoomActive.set(false);

    await v.react();
    v.onVisibleRangeChange.mockClear();
    await act(() => pan.handlers.onEnd!());
    expect(v.onVisibleRangeChange.mock.calls).toEqual([visibleRange(G60, home.k, home.tx + 100)]);
    await act(() => pan.handlers.onFinalize!());
    expect(v.result.current.transform.panActive.get()).toBe(false);
  });

  it('봉 좌표를 받기 전에는 핀치·드래그가 행렬을 바꾸지 않고 범위도 알리지 않는다', async () => {
    const v = await setup({ periodBars: 20 });
    const before = v.matrix();
    const { pinch, pan } = v.gestures();
    await act(() => pinch.handlers.onStart!({ focalX: 100 }));
    await act(() => pinch.handlers.onChange!({ scale: 2, focalX: 100 }));
    await act(() => pan.handlers.onChange!({ changeX: 50 }));
    await act(() => pinch.handlers.onEnd!());
    expect(v.matrix()).toEqual(before);
    expect(v.onVisibleRangeChange).not.toHaveBeenCalled();
  });
});

describe('useChartViewport 십자선', () => {
  const showAt = async (v: Awaited<ReturnType<typeof setup>>, index: number) => {
    press.isActive.set(true);
    press.matchedIndex.set(index);
    await v.react();
  };

  it('봉에 붙을 때마다 햅틱을 주고 십자선 x와 행렬 값을 상세 박스에 넘긴다', async () => {
    const v = await setup({ periodBars: 20 });
    await v.report(G60);
    press.x.position.set(450);
    await v.rerender({});
    const home = periodTransform(G60, 20);

    await showAt(v, 45);
    expect(v.result.current.detail).toEqual({
      index: 45,
      x: home.k * 450 + home.tx,
      view: { scaleX: home.k, translateX: home.tx, scaleY: home.ky, translateY: home.ty },
    });
    expect(v.result.current.crosshair.visible.get()).toBe(true);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);

    // 같은 봉이면 다시 알리지 않는다
    await v.react();
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(1);
    await showAt(v, 46);
    expect(Haptics.selectionAsync).toHaveBeenCalledTimes(2);
  });

  it('누르지 않은 상태의 순번은 무시한다', async () => {
    const v = await setup({ periodBars: 20 });
    press.matchedIndex.set(3);
    await v.react();
    expect(v.result.current.detail).toBeNull();
    expect(v.result.current.crosshair.visible.get()).toBe(false);
    expect(Haptics.selectionAsync).not.toHaveBeenCalled();
  });

  it('차트를 한 번 더 누르면(탭) 십자선과 상세 박스를 지운다', async () => {
    const v = await setup({ periodBars: 20 });
    await showAt(v, 1);
    expect(v.result.current.pressConfig.pan).toEqual({});

    await act(() => v.gestures().tap.handlers.onEnd!());
    expect(v.result.current.detail).toBeNull();
    expect(v.result.current.crosshair.visible.get()).toBe(false);
    expect(v.result.current.pressConfig.pan).toEqual({ activateAfterLongPress: 300 });
  });

  it('차트 밖 버튼의 hideCrosshair도 지운다', async () => {
    const v = await setup({ periodBars: 20 });
    await showAt(v, 1);
    await act(() => v.result.current.hideCrosshair());
    expect(v.result.current.detail).toBeNull();
    expect(v.result.current.crosshair.visible.get()).toBe(false);
    expect(v.result.current.pressConfig.pan).toEqual({ activateAfterLongPress: 300 });
  });

  it('기간 칩으로 기간에 다시 맞추면 지우고, 제스처로 바꾼 범위(null)에서는 남긴다', async () => {
    const v = await setup({ periodBars: 20 });
    await showAt(v, 1);
    await v.rerender({ periodBars: null });
    expect(v.result.current.detail?.index).toBe(1);
    expect(v.result.current.crosshair.visible.get()).toBe(true);

    await v.rerender({ periodBars: 40 });
    expect(v.result.current.detail).toBeNull();
    expect(v.result.current.crosshair.visible.get()).toBe(false);
    expect(v.result.current.pressConfig.pan).toEqual({ activateAfterLongPress: 300 });
  });
});

describe('useReportGeom', () => {
  const bounds: ChartBounds = { left: 10, right: 310, top: 5, bottom: 205 };

  async function reportWith(hi: PointsArray, lo: PointsArray, dates: readonly string[]) {
    const onGeom = jest.fn<void, [CandleGeom, { first: string; last: string }]>();
    function Harness() {
      useReportGeom(hi, lo, bounds, dates, onGeom);
      return null;
    }
    await render(<Harness />);
    return onGeom;
  }

  it('봉 좌표와 날짜 구간을 넘기고, y가 없는 점은 0으로 둔다', async () => {
    const lo = LO.map((p, i) => (i === 1 ? { ...p, y: undefined } : p));
    const onGeom = await reportWith(HI, lo, DATES);
    expect(onGeom).toHaveBeenCalledWith(
      {
        left: 10,
        right: 310,
        top: 5,
        bottom: 205,
        x0: 0,
        dx: 100,
        highY: [50, 50, 50],
        lowY: [150, 0, 150],
      },
      { first: '2026-10-28', last: '2026-10-30' },
    );
  });

  it('봉이 하나뿐이면 차트 폭을 간격으로 둔다', async () => {
    const onGeom = await reportWith(HI.slice(0, 1), LO.slice(0, 1), DATES.slice(0, 1));
    expect(onGeom.mock.calls[0]?.[0]).toMatchObject({ x0: 0, dx: 300 });
    expect(onGeom.mock.calls[0]?.[1]).toEqual({ first: '2026-10-28', last: '2026-10-28' });
  });

  it('봉이 없으면 보고하지 않는다', async () => {
    const onGeom = await reportWith([], [], []);
    expect(onGeom).not.toHaveBeenCalled();
  });

  it('날짜가 없으면 빈 문자열 구간이다', async () => {
    const onGeom = await reportWith(HI, LO, []);
    expect(onGeom.mock.calls[0]?.[1]).toEqual({ first: '', last: '' });
  });
});

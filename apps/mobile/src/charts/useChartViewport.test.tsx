import { act, render, renderHook } from '@testing-library/react-native';
import { useMemo } from 'react';
import { makeMutable } from 'react-native-reanimated';
import type { ChartBounds, PointsArray } from 'victory-native';
import type { CrosshairPress } from './CrosshairLayer';
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
    useAnimatedStyle: () => ({}),
    useFrameCallback: () => ({ setActive: () => undefined }),
  };
});

// Gesture Handler도 네이티브 바인딩이 없다. 제스처는 메서드를 이어 불러도 자기를 돌려주는 빈 객체로 둔다
jest.mock('react-native-gesture-handler', () => {
  const chain: object = new Proxy({}, { get: () => () => chain });
  return { Gesture: new Proxy({}, { get: () => () => chain }) };
});

// Skia는 Jest에서 돌지 않는다. 이 hook은 CrosshairLayer의 위치 계산만 쓰고 그리지 않는다
jest.mock('@shopify/react-native-skia', () => ({}));

// 실제 victory-native처럼 useChartTransformState가 렌더링마다 새 state 객체(panActive·zoomActive도 새 값)를
// 돌려준다. 행렬은 배율·이동만 담은 객체로 둔다
type MockMatrix = { k: number; tx: number };
jest.mock('victory-native', () => {
  const { useSharedValue, makeMutable: mutable } =
    jest.requireMock<typeof import('react-native-reanimated')>('react-native-reanimated');
  return {
    useChartTransformState: () => {
      const matrix = useSharedValue<MockMatrix>({ k: 1, tx: 0 });
      const offset = useSharedValue<MockMatrix>({ k: 1, tx: 0 });
      const origin = useSharedValue({ x: 0, y: 0 });
      return {
        state: { panActive: mutable(false), zoomActive: mutable(false), origin, matrix, offset },
      };
    },
    getTransformComponents: (m: MockMatrix) => ({
      scaleX: m.k,
      scaleY: 1,
      translateX: m.tx,
      translateY: 0,
    }),
    setScale: (m: MockMatrix, k: number) => ({ ...m, k }),
    setTranslate: (m: MockMatrix, tx: number) => ({ ...m, tx }),
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
});

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

import { useCallback, useRef } from 'react';
import { useAnimatedReaction, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import type { SharedValue } from 'react-native-reanimated';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';
import { PERF_ENABLED, perfLine, perfNow } from '@/lib/perfLog';
import type { ChartGesture } from './useChartViewport';

// 이 간격(ms)보다 긴 프레임은 끊겨 보이는 프레임으로 센다(30fps 아래)
const LONG_FRAME_MS = 34;

type FrameStats = { frames: number; first: number; last: number; maxGap: number; long: number };

const EMPTY: FrameStats = { frames: 0, first: 0, last: 0, maxGap: 0, long: 0 };

function addFrame(s: FrameStats, at: number, gap: number): FrameStats {
  'worklet';
  return {
    frames: s.frames + 1,
    first: s.frames === 0 ? at : s.first,
    last: at,
    maxGap: Math.max(s.maxGap, gap),
    long: s.long + (gap > LONG_FRAME_MS ? 1 : 0),
  };
}

function describe(s: FrameStats) {
  const ms = s.last - s.first;
  const fps = ms > 0 ? ((s.frames - 1) * 1000) / ms : 0;
  return `${Math.round(fps)}fps · max ${Math.round(s.maxGap)}ms · long ${s.long}`;
}

// 제스처(드래그·핀치) 하나 동안 UI 스레드(행렬·Skia 그리기)와 JS 스레드 프레임을 재서 끝날 때
// `[perf] gesture pan 1.2s · UI 118fps · max 17ms · long 0 · JS ...`로 찍는다(dev 변형만, D-104 측정용).
// 120Hz 기기는 매끄러우면 UI가 120fps 근처다. 처음 프레임은 제스처 시작 뒤부터 센다
export function useGestureFps(active: SharedValue<ChartGesture | null>) {
  const ui = useSharedValue<FrameStats>(EMPTY);
  const frame = useFrameCallback((info) => {
    'worklet';
    ui.set(addFrame(ui.get(), info.timestamp, info.timeSincePreviousFrame ?? 0));
  }, false);

  const js = useRef<{ stats: FrameStats; raf: number; kind: ChartGesture }>({
    stats: EMPTY,
    raf: 0,
    kind: 'pan',
  });

  const report = useCallback((uiStats: FrameStats) => {
    const { stats, kind } = js.current;
    const seconds = ((uiStats.last - uiStats.first) / 1000).toFixed(1);
    perfLine(
      `[perf] gesture ${kind} ${seconds}s · UI ${describe(uiStats)} · JS ${describe(stats)}`,
    );
  }, []);

  const start = useCallback(
    (kind: ChartGesture) => {
      js.current.kind = kind;
      js.current.stats = EMPTY;
      const tick = () => {
        const at = perfNow();
        const s = js.current.stats;
        js.current.stats = addFrame(s, at, s.frames === 0 ? 0 : at - s.last);
        js.current.raf = requestAnimationFrame(tick);
      };
      js.current.raf = requestAnimationFrame(tick);
      frame.setActive(true);
    },
    [frame],
  );

  // 핀치가 겹치면 핀치로 기록한다
  const upgrade = useCallback((kind: ChartGesture) => {
    if (kind === 'zoom') js.current.kind = 'zoom';
  }, []);

  const stop = useCallback(() => {
    cancelAnimationFrame(js.current.raf);
    frame.setActive(false);
    // JS에서 읽으면 이전 값일 수 있어 UI 스레드에서 읽어 넘긴다
    scheduleOnUI(() => {
      'worklet';
      const s = ui.get();
      ui.set(EMPTY);
      scheduleOnRN(report, s);
    });
  }, [frame, report, ui]);

  useAnimatedReaction(
    () => active.get(),
    (gesture, prev) => {
      if (!PERF_ENABLED || gesture === prev) return;
      if (gesture !== null && prev == null) scheduleOnRN(start, gesture);
      else if (gesture !== null) scheduleOnRN(upgrade, gesture);
      else scheduleOnRN(stop);
    },
  );
}

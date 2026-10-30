// 차트 화면 첫 로딩이 어느 단계에서 느린지 찾기 위한 개발용 측정 로그. Metro 콘솔에 `[perf]`로 남긴다.
// 개발 번들(__DEV__)에서만 켜지고 테스트에서는 끈다. 개발 번들은 release보다 느려 절대값보다 단계 비율을 본다
export const PERF_ENABLED = __DEV__ && process.env.NODE_ENV !== 'test';

const now = () => performance.now();

// 화면 진입 시점. 이후 perfMark는 이 시점부터 지난 시간을 함께 찍는다
let origin: { label: string; at: number } | null = null;

export function perfStart(label: string) {
  if (!PERF_ENABLED) return;
  origin = { label, at: now() };
  console.log(`[perf] ${label} start`);
}

// 진입 뒤 단계 하나. done이면 진입 측정을 끝낸다(다른 화면의 차트가 이어서 찍지 않게)
export function perfMark(step: string, done = false) {
  if (!PERF_ENABLED || !origin) return;
  console.log(`[perf] ${origin.label} +${Math.round(now() - origin.at)}ms ${step}`);
  if (done) origin = null;
}

// fn 실행 시간을 재서 찍고 결과를 돌려준다
export function perfTime<T>(step: string, fn: () => T): T {
  if (!PERF_ENABLED) return fn();
  const start = now();
  const result = fn();
  perfMark(`${step} ${Math.round(now() - start)}ms`);
  return result;
}

// 요청 하나의 단계별 시간(ms). 진입 측정과 상관없이 모든 API 요청을 찍는다
export function perfRequest(path: string, bytes: number, steps: Record<string, number>) {
  if (!PERF_ENABLED) return;
  const parts = Object.entries(steps).map(([k, ms]) => `${k} ${Math.round(ms)}ms`);
  console.log(`[perf] ${path} ${Math.round(bytes / 1024)}KB · ${parts.join(' · ')}`);
  perfMark(`response ${path}`);
}

export const perfNow = now;

import { apiUrl, isDevVariant } from '@/api/config';

// 차트 화면이 어느 단계에서 느린지 찾기 위한 측정 로그. Metro 콘솔에 `[perf]`로 남긴다.
// dev 변형에서만 켜고 테스트에서는 끈다. 개발 번들은 release보다 몇 배 느려, 절대값은 운영 번들로 잰다
// (앱을 `-RCT_enableDev NO` 인자로 띄움). 운영 번들은 console 로그를 Metro로 보내지 않아, 같은 줄을
// dev 서버 주소의 Mac에서 도는 수집기(`npm run perf:collect`)로도 보낸다. 어느 번들인지 시작할 때 한 줄 찍는다
export const PERF_ENABLED = isDevVariant && process.env.NODE_ENV !== 'test';

const COLLECTOR_PORT = 8099;
const collectorUrl = __DEV__
  ? null
  : apiUrl.replace(/^(https?:\/\/[^/:]+)(:\d+)?.*$/, `$1:${COLLECTOR_PORT}/perf`);

// 로그 한 줄. 수집기가 꺼져 있으면 버린다
export function perfLine(line: string) {
  if (!PERF_ENABLED) return;
  console.log(line);
  if (collectorUrl) fetch(collectorUrl, { method: 'POST', body: line }).catch(() => undefined);
}

perfLine(`[perf] bundle ${__DEV__ ? 'dev' : 'prod'}`);

const now = () => performance.now();

// 화면 진입 시점. 이후 perfMark는 이 시점부터 지난 시간을 함께 찍는다
let origin: { label: string; at: number } | null = null;

export function perfStart(label: string) {
  if (!PERF_ENABLED) return;
  origin = { label, at: now() };
  perfLine(`[perf] ${label} start`);
}

// 진입 뒤 단계 하나. done이면 진입 측정을 끝낸다(다른 화면의 차트가 이어서 찍지 않게)
export function perfMark(step: string, done = false) {
  if (!PERF_ENABLED || !origin) return;
  perfLine(`[perf] ${origin.label} +${Math.round(now() - origin.at)}ms ${step}`);
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
  perfLine(`[perf] ${path} ${Math.round(bytes / 1024)}KB · ${parts.join(' · ')}`);
  perfMark(`response ${path}`);
}

export const perfNow = now;

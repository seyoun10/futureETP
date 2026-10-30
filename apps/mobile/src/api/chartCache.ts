import type { Freshness } from '@futureetp/shared';

// C 차트 응답은 크고(C-a는 봉 수천 개) 첫 조회·그리기가 느리다. 화면을 떠나도 1시간은 캐시에 둔다
export const CHART_GC_TIME_MS = 60 * 60 * 1000;

// 차트 값은 배치 때만 바뀌므로 `nextUpdateAt`까지는 다시 조회하지 않는다(화면 재진입·앱 복귀).
// 시각이 지났거나 null이면 바로 오래된 값으로 본다. 당겨서 새로고침·자동 새로고침은 staleTime과 상관없이 조회한다
export function staleUntilNextUpdate(
  query: { state: { data?: { freshness: Freshness } } },
  now = Date.now(),
): number {
  const nextUpdateAt = query.state.data?.freshness.nextUpdateAt;
  if (!nextUpdateAt) return 0;
  return Math.max(0, Date.parse(nextUpdateAt) - now);
}

export const chartCacheOptions = {
  staleTime: staleUntilNextUpdate,
  gcTime: CHART_GC_TIME_MS,
};

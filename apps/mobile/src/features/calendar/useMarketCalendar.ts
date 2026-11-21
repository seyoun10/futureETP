import type { Calendar } from '@futureetp/shared';
import { useQuery } from '@tanstack/react-query';
import { getCalendar } from '@/api/calendar';
import { queryKeys } from '@/api/queryKeys';

// 휴장 일정은 연 몇 번만 바뀌므로 오래 둔다
const STALE_MS = 12 * 60 * 60 * 1000;
// 입력되지 않은 (시장, 연도)가 있으면 곧 import될 수 있으니 화면 재진입·앱 복귀 때 다시 조회한다
export const MISSING_STALE_MS = 5 * 60 * 1000;

// 빈 달력(missing 있음)을 12시간 붙잡으면 서버에 import한 뒤에도 앱을 다시 켜야 보인다
export function calendarStaleTime(query: { state: { data?: Calendar } }): number {
  const missing = query.state.data?.missing;
  return missing && missing.length > 0 ? MISSING_STALE_MS : STALE_MS;
}

export const useMarketCalendar = (from: string, to: string) =>
  useQuery({
    queryKey: queryKeys.calendar(from, to),
    queryFn: ({ signal }) => getCalendar(from, to, signal),
    staleTime: calendarStaleTime,
  });

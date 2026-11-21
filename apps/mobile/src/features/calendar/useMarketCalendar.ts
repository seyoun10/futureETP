import { useQuery } from '@tanstack/react-query';
import { getCalendar } from '@/api/calendar';
import { queryKeys } from '@/api/queryKeys';

// 휴장 일정은 연 몇 번만 바뀌므로 오래 둔다
const STALE_MS = 12 * 60 * 60 * 1000;

export const useMarketCalendar = (from: string, to: string) =>
  useQuery({
    queryKey: queryKeys.calendar(from, to),
    queryFn: ({ signal }) => getCalendar(from, to, signal),
    staleTime: STALE_MS,
  });

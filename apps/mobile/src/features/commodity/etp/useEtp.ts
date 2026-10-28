import { useQuery } from '@tanstack/react-query';
import { getEtp } from '@/api/etps';
import { queryKeys } from '@/api/queryKeys';

export const useEtp = (id: string) =>
  useQuery({
    queryKey: queryKeys.etps.detail(id),
    queryFn: ({ signal }) => getEtp(id, signal),
  });

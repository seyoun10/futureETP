import { useQuery } from '@tanstack/react-query';
import { getCommodities } from '@/api/commodities';
import { queryKeys } from '@/api/queryKeys';

export const useCommodities = () =>
  useQuery({
    queryKey: queryKeys.commodities.list(),
    queryFn: ({ signal }) => getCommodities(signal),
  });

import type { CommodityCode } from '@futureetp/shared';
import { useQuery } from '@tanstack/react-query';
import { getEtps } from '@/api/etps';
import { queryKeys } from '@/api/queryKeys';

export const useEtps = (code: CommodityCode) =>
  useQuery({
    queryKey: queryKeys.commodities.etps(code),
    queryFn: ({ signal }) => getEtps(code, signal),
  });

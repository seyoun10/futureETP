import type { CommodityCode } from '@futureetp/shared';
import { useQuery } from '@tanstack/react-query';
import { getContracts } from '@/api/commodities';
import { queryKeys } from '@/api/queryKeys';

export const useContracts = (code: CommodityCode) =>
  useQuery({
    queryKey: queryKeys.commodities.contracts(code),
    queryFn: ({ signal }) => getContracts(code, signal),
  });

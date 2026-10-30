import type { CommodityCode, ContractsChart } from '@futureetp/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData } from '@tanstack/react-query';
import { chartCacheOptions } from '@/api/chartCache';
import { getContracts } from '@/api/commodities';
import { queryKeys } from '@/api/queryKeys';

// 최근 페이지(pages[0])의 값에 이전 페이지의 날짜·가격을 앞에 붙인다. 월물은 최근 페이지 목록을 따르고,
// 이전 페이지에 없는 월물은 그 구간을 null로 채운다
export function mergeContractPages(data: InfiniteData<ContractsChart>): ContractsChart {
  const [latest, ...older] = data.pages;
  if (older.length === 0) return latest;
  const pages = [...older].reverse();
  return {
    ...latest,
    dates: pages.flatMap((p) => p.dates).concat(latest.dates),
    contracts: latest.contracts.map((c) => ({
      ...c,
      prices: pages
        .flatMap(
          (p) =>
            p.contracts.find((o) => o.symbol === c.symbol)?.prices ??
            p.dates.map((): number | null => null),
        )
        .concat(c.prices),
    })),
    hasMore: data.pages[data.pages.length - 1].hasMore,
  };
}

// 서버는 5년씩 준다(D-104). 다음 페이지는 지금까지 받은 가장 이른 날보다 이전 5년이다
export const useContracts = (code: CommodityCode) =>
  useInfiniteQuery({
    queryKey: queryKeys.commodities.contracts(code),
    queryFn: ({ signal, pageParam }) => getContracts(code, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.hasMore ? last.dates[0] : undefined),
    select: mergeContractPages,
    ...chartCacheOptions,
  });

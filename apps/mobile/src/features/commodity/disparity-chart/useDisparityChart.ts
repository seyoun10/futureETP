import type { CommodityCode, DisparityChart, Settings } from '@futureetp/shared';
import { infiniteQueryOptions, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { chartCacheOptions } from '@/api/chartCache';
import { getDisparityChart } from '@/api/commodities';
import { queryKeys } from '@/api/queryKeys';
import type { DisparityParams } from '@/api/queryKeys';
import { settingsQuery, useSettings } from '@/features/settings/useSettings';

const disparityParams = (settings: Settings): DisparityParams => ({
  basis: settings.basis,
  ma: settings.maPeriod,
  window: settings.window,
  levels: settings.rareLevels,
});

// 서버는 5년씩 준다(D-104). 다음 페이지는 지금까지 받은 가장 이른 봉보다 이전 5년이다
const nextBefore = (last: DisparityChart) => (last.hasMore ? last.bars[0]?.tradeDate : undefined);

// 최근 페이지(pages[0])의 값에 이전 페이지 봉을 앞에 붙여 한 응답처럼 만든다
export function mergeDisparityPages(data: InfiniteData<DisparityChart>): DisparityChart {
  const [latest, ...older] = data.pages;
  if (older.length === 0) return latest;
  return {
    ...latest,
    bars: [...older]
      .reverse()
      .flatMap((p) => p.bars)
      .concat(latest.bars),
    hasMore: data.pages[data.pages.length - 1].hasMore,
  };
}

const disparityChartQuery = (code: CommodityCode, params: DisparityParams) =>
  infiniteQueryOptions({
    queryKey: queryKeys.commodities.disparity(code, params),
    queryFn: ({ signal, pageParam }) => getDisparityChart(code, params, pageParam, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextBefore,
    ...chartCacheOptions,
  });

// 설정(기준값·이평선·윈도·rare 레벨)을 먼저 읽고 그 값으로 C-a를 조회한다(D-086)
export function useDisparityChart(code: CommodityCode) {
  const settings = useSettings();
  const params = settings.data && disparityParams(settings.data);
  const chart = useInfiniteQuery({
    queryKey: params
      ? queryKeys.commodities.disparity(code, params)
      : [...queryKeys.commodities.detail(code), 'disparity'],
    queryFn: params
      ? ({ signal, pageParam }) => getDisparityChart(code, params, pageParam, signal)
      : skipToken,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextBefore,
    select: mergeDisparityPages,
    ...chartCacheOptions,
  });
  return { settings, chart };
}

// A에서 원자재를 누르면 화면 전환 동안 C-a 조회를 먼저 시작한다. 화면의 query가 같은 요청을 이어받는다.
// 실패는 무시한다(화면이 다시 조회하고 오류를 보여 준다)
export async function prefetchDisparityChart(queryClient: QueryClient, code: CommodityCode) {
  try {
    const settings = await queryClient.ensureQueryData(settingsQuery);
    await queryClient.prefetchInfiniteQuery(disparityChartQuery(code, disparityParams(settings)));
  } catch {
    // 설정 조회 실패
  }
}

import type { CommodityCode, DisparityChart, Settings } from '@futureetp/shared';
import { infiniteQueryOptions, skipToken, useInfiniteQuery } from '@tanstack/react-query';
import type { InfiniteData, QueryClient } from '@tanstack/react-query';
import { chartCacheOptions } from './chartCache';
import { getDisparityChart } from './commodities';
import { queryKeys } from './queryKeys';
import type { DisparityParams } from './queryKeys';
import { settingsQuery, useSettings } from './useSettings';

const disparityParams = (settings: Settings): DisparityParams => ({
  basis: settings.basis,
  ma: settings.maPeriod,
  window: settings.window,
  levels: settings.rareLevels,
});

// 서버는 3년씩 준다(D-104). 다음 페이지는 지금까지 받은 가장 이른 봉보다 이전 3년이다
const nextBefore = (last: DisparityChart) => (last.hasMore ? last.bars[0]?.tradeDate : undefined);

// 최근 페이지(pages[0])의 값에 이전 페이지 봉을 앞에 붙여 한 응답처럼 만든다
export function mergeDisparityPages(data: InfiniteData<DisparityChart>): DisparityChart {
  const [latest, ...older] = data.pages;
  // 데이터가 있으면 페이지가 하나 이상이다
  if (latest === undefined) throw new Error('No chart page');
  if (older.length === 0) return latest;
  return {
    ...latest,
    bars: [...older]
      .reverse()
      .flatMap((p) => p.bars)
      .concat(latest.bars),
    hasMore: data.pages[data.pages.length - 1]!.hasMore,
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
    // 캐시에 설정이 있으면 오래됐어도 그대로 쓴다(ensureQueryData와 같다)
    const settings = await queryClient.query({ ...settingsQuery, staleTime: 'static' });
    await queryClient.infiniteQuery(disparityChartQuery(code, disparityParams(settings)));
  } catch {
    // 설정·차트 조회 실패
  }
}

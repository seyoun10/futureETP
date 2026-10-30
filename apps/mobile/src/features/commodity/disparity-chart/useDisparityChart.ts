import type { CommodityCode, Settings } from '@futureetp/shared';
import { queryOptions, skipToken, useQuery } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
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

const disparityChartQuery = (code: CommodityCode, params: DisparityParams) =>
  queryOptions({
    queryKey: queryKeys.commodities.disparity(code, params),
    queryFn: ({ signal }) => getDisparityChart(code, params, signal),
    ...chartCacheOptions,
  });

// 설정(기준값·이평선·윈도·rare 레벨)을 먼저 읽고 그 값으로 C-a를 조회한다(D-086)
export function useDisparityChart(code: CommodityCode) {
  const settings = useSettings();
  const params = settings.data && disparityParams(settings.data);
  const chart = useQuery({
    queryKey: params
      ? queryKeys.commodities.disparity(code, params)
      : [...queryKeys.commodities.detail(code), 'disparity'],
    queryFn: params ? ({ signal }) => getDisparityChart(code, params, signal) : skipToken,
    ...chartCacheOptions,
  });
  return { settings, chart };
}

// A에서 원자재를 누르면 화면 전환 동안 C-a 조회를 먼저 시작한다. 화면의 query가 같은 요청을 이어받는다.
// 실패는 무시한다(화면이 다시 조회하고 오류를 보여 준다)
export async function prefetchDisparityChart(queryClient: QueryClient, code: CommodityCode) {
  try {
    const settings = await queryClient.ensureQueryData(settingsQuery);
    await queryClient.prefetchQuery(disparityChartQuery(code, disparityParams(settings)));
  } catch {
    // 설정 조회 실패
  }
}

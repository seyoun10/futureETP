import type { CommodityCode } from '@futureetp/shared';
import { skipToken, useQuery } from '@tanstack/react-query';
import { getDisparityChart } from '@/api/commodities';
import { queryKeys } from '@/api/queryKeys';
import { useSettings } from '@/features/settings/useSettings';

// 설정(기준값·이평선·윈도·rare 레벨)을 먼저 읽고 그 값으로 C-a를 조회한다(D-086)
export function useDisparityChart(code: CommodityCode) {
  const settings = useSettings();
  const params = settings.data && {
    basis: settings.data.basis,
    ma: settings.data.maPeriod,
    window: settings.data.window,
    levels: settings.data.rareLevels,
  };
  const chart = useQuery({
    queryKey: params
      ? queryKeys.commodities.disparity(code, params)
      : [...queryKeys.commodities.detail(code), 'disparity'],
    queryFn: params ? ({ signal }) => getDisparityChart(code, params, signal) : skipToken,
  });
  return { settings, chart };
}

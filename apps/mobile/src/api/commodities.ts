import { commoditiesSchema, disparityChartSchema } from '@futureetp/shared';
import type { CommodityCode } from '@futureetp/shared';
import { apiRequest } from './client';
import type { DisparityParams } from './queryKeys';

export const getCommodities = (signal?: AbortSignal) =>
  apiRequest('/commodities', commoditiesSchema, { signal });

export const getDisparityChart = (
  code: CommodityCode,
  { basis, ma, window, levels }: DisparityParams,
  signal?: AbortSignal,
) =>
  apiRequest(`/commodities/${code}/disparity`, disparityChartSchema, {
    query: { basis, ma, window, levels: levels.join(',') },
    signal,
  });

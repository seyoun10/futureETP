import {
  commoditiesSchema,
  contractsChartSchema,
  curveSchema,
  disparityChartSchema,
} from '@futureetp/shared';
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

// baseDate가 null이면 서버 기본값(D-1). 휴장일이면 서버가 거래일로 옮긴다(D-090)
export const getCurve = (code: CommodityCode, baseDate: string | null, signal?: AbortSignal) =>
  apiRequest(`/commodities/${code}/curve`, curveSchema, {
    query: { baseDate: baseDate ?? undefined },
    signal,
  });

// query가 없다. 기간·제스처는 받은 데이터 안에서 고른다(D-092)
export const getContracts = (code: CommodityCode, signal?: AbortSignal) =>
  apiRequest(`/commodities/${code}/contracts`, contractsChartSchema, { signal });

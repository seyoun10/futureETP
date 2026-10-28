import { etpDetailSchema, etpListSchema } from '@futureetp/shared';
import type { CommodityCode } from '@futureetp/shared';
import { apiRequest } from './client';

// 필터·정렬은 앱에서 한다(C-d)
export const getEtps = (code: CommodityCode, signal?: AbortSignal) =>
  apiRequest(`/commodities/${code}/etps`, etpListSchema, { signal });

export const getEtp = (id: string, signal?: AbortSignal) =>
  apiRequest(`/etps/${encodeURIComponent(id)}`, etpDetailSchema, { signal });

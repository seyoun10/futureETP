import { commoditiesSchema } from '@futureetp/shared';
import { apiRequest } from './client';

export const getCommodities = (signal?: AbortSignal) =>
  apiRequest('/commodities', commoditiesSchema, { signal });

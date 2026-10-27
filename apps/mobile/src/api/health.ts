import { healthSchema } from '@futureetp/shared';
import { apiRequest } from './client';

export const getHealth = (signal?: AbortSignal) =>
  apiRequest('/health', healthSchema, { auth: false, signal });

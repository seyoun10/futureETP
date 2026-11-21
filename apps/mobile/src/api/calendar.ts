import { calendarSchema } from '@futureetp/shared';
import { apiRequest } from './client';

// 휴장 달력. from·to는 'YYYY-MM-DD'(포함)
export const getCalendar = (from: string, to: string, signal?: AbortSignal) =>
  apiRequest(`/calendar?from=${from}&to=${to}`, calendarSchema, { signal });

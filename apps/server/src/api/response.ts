import type { ApiErrorCode } from '@futureetp/shared';
import type { Context } from 'hono';
import { ERROR_STATUS } from './errors.ts';

// 응답 봉투(D-042). 성공·실패 모두 이 두 함수로만 보낸다.
export const ok = <T>(c: Context, data: T) => c.json({ success: true as const, data });

export const fail = (c: Context, code: ApiErrorCode, message: string) =>
  c.json({ success: false as const, error: { code, message } }, ERROR_STATUS[code]);

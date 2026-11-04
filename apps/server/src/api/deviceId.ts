import { DEVICE_ID_HEADER, deviceIdSchema } from '@futureetp/shared';
import type { Context } from 'hono';
import { ApiException } from './errors.ts';

// 설정·알림을 나누는 기기 키(D-120). 없거나 UUID가 아니면 VALIDATION_FAILED.
export function requireDeviceId(c: Context): string {
  const parsed = deviceIdSchema.safeParse(c.req.header(DEVICE_ID_HEADER));
  if (!parsed.success) {
    throw new ApiException('VALIDATION_FAILED', `${DEVICE_ID_HEADER} header must be a UUID`);
  }
  return parsed.data.toLowerCase();
}

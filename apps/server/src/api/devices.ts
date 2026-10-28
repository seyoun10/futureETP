import { deviceRegistrationSchema } from '@futureetp/shared';
import type { Device, DeviceRegistration } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiException } from './errors.ts';
import { ok } from './response.ts';

export type DevicesStore = {
  // pushToken이 같은 행이 있으면 플랫폼·앱 버전·갱신 시각을 바꾼다.
  upsert: (registration: DeviceRegistration) => Promise<Device>;
};

// PUT /v1/devices(D-048). 무효 토큰 삭제는 발송 결과로 서버가 한다(D-023, D-037).
export function devicesRoutes(store: DevicesStore) {
  const routes = new Hono();
  routes.put('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiException('VALIDATION_FAILED', 'Body must be JSON');
    }
    const parsed = deviceRegistrationSchema.safeParse(body);
    if (!parsed.success) throw new ApiException('VALIDATION_FAILED', z.prettifyError(parsed.error));
    return ok(c, await store.upsert(parsed.data));
  });
  return routes;
}

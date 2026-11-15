import { deviceRegistrationSchema } from '@futureetp/shared';
import type { Device, DeviceRegistration } from '@futureetp/shared';
import { Hono } from 'hono';
import { requireDeviceId } from './deviceId.ts';
import { jsonBody, parseInput } from './params.ts';
import { ok } from './response.ts';

export type DevicesStore = {
  // 헤더 기기 행에 토큰·플랫폼·앱 버전을 쓴다(없으면 기본값 설정으로 만듦).
  // 다른 기기 행이 같은 토큰을 갖고 있으면 그 행의 토큰을 비운다(D-120).
  upsert: (deviceId: string, registration: DeviceRegistration) => Promise<Device>;
};

// PUT /v1/devices(D-048, D-120). 무효 토큰 비우기는 발송 결과로 서버가 한다(D-023, D-037).
export function devicesRoutes(store: DevicesStore) {
  const routes = new Hono();
  routes.put('/', async (c) => {
    const deviceId = requireDeviceId(c);
    const parsed = parseInput(deviceRegistrationSchema, await jsonBody(c));
    return ok(c, await store.upsert(deviceId, parsed));
  });
  return routes;
}

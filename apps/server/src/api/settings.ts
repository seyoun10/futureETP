import { settingsPatchSchema } from '@futureetp/shared';
import type { Settings, SettingsPatch } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { requireDeviceId } from './deviceId.ts';
import { ApiException } from './errors.ts';
import { ok } from './response.ts';

export type SettingsStore = {
  // 처음 보인 기기는 기본값으로 만든다(D-120).
  get: (deviceId: string) => Promise<Settings>;
  // 바꾼 뒤의 전체 설정을 돌려준다.
  update: (deviceId: string, patch: SettingsPatch) => Promise<Settings>;
};

// GET·PATCH /v1/settings(D-081). 헤더 기기의 설정이다(D-120). 검증은 shared 스키마 하나로 앱 입력 검사와 같게 한다.
export function settingsRoutes(store: SettingsStore) {
  const routes = new Hono();
  routes.get('/', async (c) => ok(c, await store.get(requireDeviceId(c))));
  routes.patch('/', async (c) => {
    const deviceId = requireDeviceId(c);
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiException('VALIDATION_FAILED', 'Body must be JSON');
    }
    const parsed = settingsPatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiException('VALIDATION_FAILED', z.prettifyError(parsed.error));
    return ok(c, await store.update(deviceId, parsed.data));
  });
  return routes;
}

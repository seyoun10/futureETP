import { settingsPatchSchema } from '@futureetp/shared';
import type { Settings, SettingsPatch } from '@futureetp/shared';
import { Hono } from 'hono';
import { requireDeviceId } from './deviceId.ts';
import { jsonBody, parseInput } from './params.ts';
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
    const parsed = parseInput(settingsPatchSchema, await jsonBody(c));
    return ok(c, await store.update(deviceId, parsed));
  });
  return routes;
}

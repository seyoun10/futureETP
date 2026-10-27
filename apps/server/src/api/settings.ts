import { settingsPatchSchema } from '@futureetp/shared';
import type { Settings, SettingsPatch } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiException } from './errors.ts';
import { ok } from './response.ts';

export type SettingsStore = {
  get: () => Promise<Settings>;
  // 바꾼 뒤의 전체 설정을 돌려준다.
  update: (patch: SettingsPatch) => Promise<Settings>;
};

// GET·PATCH /v1/settings(D-081). 검증은 shared 스키마 하나로 앱 입력 검사와 같게 한다.
export function settingsRoutes(store: SettingsStore) {
  const routes = new Hono();
  routes.get('/', async (c) => ok(c, await store.get()));
  routes.patch('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      throw new ApiException('VALIDATION_FAILED', 'Body must be JSON');
    }
    const parsed = settingsPatchSchema.safeParse(body);
    if (!parsed.success) throw new ApiException('VALIDATION_FAILED', z.prettifyError(parsed.error));
    return ok(c, await store.update(parsed.data));
  });
  return routes;
}

import { settingsSchema } from '@futureetp/shared';
import type { SettingsPatch } from '@futureetp/shared';
import { apiRequest } from './client';

export const getSettings = (signal?: AbortSignal) =>
  apiRequest('/settings', settingsSchema, { signal });

export const patchSettings = (patch: SettingsPatch) =>
  apiRequest('/settings', settingsSchema, { method: 'PATCH', body: patch });

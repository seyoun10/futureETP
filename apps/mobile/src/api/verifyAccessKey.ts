import { settingsSchema } from '@futureetp/shared';
import { apiRequest } from './client';

// 입력한 키로 GET /v1/settings를 한 번 불러 서버가 받는지 확인한다(D-044, D-081).
export async function verifyAccessKey(key: string) {
  await apiRequest('/settings', settingsSchema, { token: key });
}

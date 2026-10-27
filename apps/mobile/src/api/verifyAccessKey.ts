import { z } from 'zod';
import { apiRequest } from './client';

// 입력한 키로 인증이 필요한 조회를 한 번 불러 서버가 받는지 확인한다(D-044).
// GET /v1/settings 응답 스키마는 5-6에서 정하므로 지금은 인증 통과만 본다.
export async function verifyAccessKey(key: string) {
  await apiRequest('/settings', z.unknown(), { token: key });
}

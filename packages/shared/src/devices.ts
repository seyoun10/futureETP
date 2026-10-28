import { z } from 'zod';
import { PLATFORMS } from './domain.ts';

// FCM 토큰은 보통 150~300자다. 비정상 입력만 막는다.
export const PUSH_TOKEN_MAX_LENGTH = 4096;

// PUT /v1/devices 본문(D-048). 앱 실행 때 푸시 토큰이 있을 때만 보낸다. pushToken 기준으로 upsert한다.
export const deviceRegistrationSchema = z.strictObject({
  pushToken: z.string().trim().min(1).max(PUSH_TOKEN_MAX_LENGTH),
  platform: z.enum(PLATFORMS),
  // 예: 1.0.0. 모르면 null
  appVersion: z.string().max(64).nullable(),
});
export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>;

// 응답 data
export const deviceSchema = z.object({ id: z.uuid() });
export type Device = z.infer<typeof deviceSchema>;

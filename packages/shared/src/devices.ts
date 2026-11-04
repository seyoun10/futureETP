import { z } from 'zod';
import { PLATFORMS } from './domain.ts';

// 기기 키 헤더(D-120). 앱이 만든 UUID v4를 인증 요청마다 보낸다. 서버는 설정·알림을 이 값으로 나눈다.
export const DEVICE_ID_HEADER = 'X-Device-Id';
export const deviceIdSchema = z.uuid();

// FCM 토큰은 보통 150~300자다. 비정상 입력만 막는다.
export const PUSH_TOKEN_MAX_LENGTH = 4096;

// PUT /v1/devices 본문(D-048, D-120). 앱 실행 때 보낸다. 헤더 기기 행에 upsert한다.
export const deviceRegistrationSchema = z.strictObject({
  // 토큰을 못 받으면(권한 없음 등) null. 그 기기에는 보내지 않는다.
  pushToken: z.string().trim().min(1).max(PUSH_TOKEN_MAX_LENGTH).nullable(),
  platform: z.enum(PLATFORMS),
  // 예: 1.0.0. 모르면 null
  appVersion: z.string().max(64).nullable(),
});
export type DeviceRegistration = z.infer<typeof deviceRegistrationSchema>;

// 응답 data
export const deviceSchema = z.object({ id: z.uuid() });
export type Device = z.infer<typeof deviceSchema>;

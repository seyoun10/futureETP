// 서버가 쓰는 발송기 하나(D-037). 서비스 계정 키(FCM_SERVICE_ACCOUNT_PATH)가 없으면 모든 발송이 FAILED가 되어
// rare 레벨 알림은 RETRY → FAILED로, 운영 알림은 다음 최종 실패 때 다시 시도한다(D-023, D-045).
import { config } from '../config.ts';
import { createFcmMessaging, createFcmSender } from './fcmSender.ts';
import type { PushSender } from './sender.ts';

const unconfigured: PushSender = {
  send: () => Promise.resolve({ status: 'FAILED', error: 'FCM_SERVICE_ACCOUNT_PATH is not set' }),
};

export const pushSender: PushSender = config.FCM_SERVICE_ACCOUNT_PATH
  ? createFcmSender(createFcmMessaging(config.FCM_SERVICE_ACCOUNT_PATH))
  : unconfigured;

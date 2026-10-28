// FCM HTTP v1 발송기(Android, D-037). firebase-admin으로 서비스 계정 키(FCM_SERVICE_ACCOUNT_PATH)를 읽는다.
// iOS 기기는 APNs 발송기(Apple 가입 뒤)가 맡으므로 여기서는 실패로 돌려준다.
import { cert, initializeApp } from 'firebase-admin/app';
import { getMessaging, type Message, type Messaging } from 'firebase-admin/messaging';
import type { PushSender } from './sender.ts';

// D-023: 이 코드만 무효 토큰으로 보고 기기를 지운다(FCM UNREGISTERED)
const UNREGISTERED = 'messaging/registration-token-not-registered';

export type FcmMessaging = Pick<Messaging, 'send'>;

export function createFcmMessaging(serviceAccountPath: string): FcmMessaging {
  return getMessaging(initializeApp({ credential: cert(serviceAccountPath) }, 'fcm'));
}

export function createFcmSender(messaging: FcmMessaging): PushSender {
  return {
    async send(target, { text, channel, data }) {
      if (target.platform !== 'ANDROID') {
        return { status: 'FAILED', error: `${target.platform} sender not configured` };
      }
      const message: Message = {
        token: target.pushToken,
        notification: { title: text.title, ...(text.body === null ? {} : { body: text.body }) },
        data,
        android: { priority: 'high', notification: { channelId: channel } },
      };
      try {
        await messaging.send(message);
        return { status: 'SENT' };
      } catch (error) {
        const code = (error as { code?: unknown }).code;
        if (code === UNREGISTERED) return { status: 'INVALID_TOKEN' };
        const reason = error instanceof Error ? error.message : String(error);
        return {
          status: 'FAILED',
          error: typeof code === 'string' ? `${code}: ${reason}` : reason,
        };
      }
    },
  };
}

// 푸시 발송 인터페이스(D-037). FCM HTTP v1(Android, 5-8)과 APNs(Apple 가입 뒤)가 구현한다.
// 문구는 shared push.ts로 만든 것을 받는다(D-040).
import type { AndroidChannel, Platform, PushText } from '@futureetp/shared';

export type PushTarget = { platform: Platform; pushToken: string };

export type PushMessage = {
  text: PushText;
  // Android 알림 채널. 운영 알림은 ops(D-045)
  channel: AndroidChannel;
  // 알림 탭 처리용 값(앱 push/)
  data?: Record<string, string>;
};

// INVALID_TOKEN은 FCM UNREGISTERED·APNs 410이다. 받으면 기기를 지운다(D-023, D-037).
export type SendResult =
  { status: 'SENT' } | { status: 'INVALID_TOKEN' } | { status: 'FAILED'; error: string };

export interface PushSender {
  send(target: PushTarget, message: PushMessage): Promise<SendResult>;
}

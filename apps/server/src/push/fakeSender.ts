// 테스트·dev용 가짜 발송기. 보낸 메시지를 기록하고, 토큰별로 정한 결과를 돌려준다(기본 SENT).
import type { PushMessage, PushSender, PushTarget, SendResult } from './sender.ts';

export function createFakeSender(results: Record<string, SendResult> = {}) {
  const sent: { target: PushTarget; message: PushMessage }[] = [];
  const sender: PushSender = {
    send(target, message) {
      sent.push({ target, message });
      return Promise.resolve(results[target.pushToken] ?? { status: 'SENT' });
    },
  };
  return { sender, sent };
}

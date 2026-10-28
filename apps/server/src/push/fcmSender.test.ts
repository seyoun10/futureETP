import type { Message } from 'firebase-admin/messaging';
import { describe, expect, it } from 'vitest';
import { createFcmSender, type FcmMessaging } from './fcmSender.ts';
import type { PushMessage } from './sender.ts';

const ANDROID = { platform: 'ANDROID', pushToken: 'tok-a' } as const;

const message: PushMessage = {
  text: { title: '금 근월물 상단 5%', body: '이격도 +3.20%' },
  channel: 'alerts',
  data: { type: 'RARE_LEVEL', commodity: 'GC' },
};

function setup(fail?: Error) {
  const sent: Message[] = [];
  const messaging: FcmMessaging = {
    send(m) {
      sent.push(m);
      return fail === undefined ? Promise.resolve('projects/p/messages/1') : Promise.reject(fail);
    },
  };
  return { sender: createFcmSender(messaging), sent };
}

const firebaseError = (code: string, text: string) => Object.assign(new Error(text), { code });

describe('createFcmSender', () => {
  it('토큰·제목·본문·데이터·Android 채널을 담아 보낸다', async () => {
    const { sender, sent } = setup();
    await expect(sender.send(ANDROID, message)).resolves.toEqual({ status: 'SENT' });
    expect(sent).toEqual([
      {
        token: 'tok-a',
        notification: { title: '금 근월물 상단 5%', body: '이격도 +3.20%' },
        data: { type: 'RARE_LEVEL', commodity: 'GC' },
        android: { priority: 'high', notification: { channelId: 'alerts' } },
      },
    ]);
  });

  it('본문이 없으면 notification.body를 넣지 않는다', async () => {
    const { sender, sent } = setup();
    await sender.send(ANDROID, { text: { title: '정산 실패', body: null }, channel: 'ops' });
    expect(sent[0].notification).toEqual({ title: '정산 실패' });
    expect(sent[0].android?.notification?.channelId).toBe('ops');
  });

  it('UNREGISTERED는 INVALID_TOKEN이다', async () => {
    const { sender } = setup(
      firebaseError('messaging/registration-token-not-registered', 'not registered'),
    );
    await expect(sender.send(ANDROID, message)).resolves.toEqual({ status: 'INVALID_TOKEN' });
  });

  it('그 밖의 오류는 코드와 함께 FAILED다', async () => {
    const { sender } = setup(firebaseError('messaging/internal-error', 'backend down'));
    await expect(sender.send(ANDROID, message)).resolves.toEqual({
      status: 'FAILED',
      error: 'messaging/internal-error: backend down',
    });
  });

  it('iOS 기기는 보내지 않고 FAILED다', async () => {
    const { sender, sent } = setup();
    await expect(sender.send({ platform: 'IOS', pushToken: 'apns' }, message)).resolves.toEqual({
      status: 'FAILED',
      error: 'IOS sender not configured',
    });
    expect(sent).toEqual([]);
  });
});

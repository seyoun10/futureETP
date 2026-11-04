import { describe, expect, it } from 'vitest';
import { broadcast, delivered, type PushDevice, type PushDeviceStore } from './broadcast.ts';
import { createFakeSender } from './fakeSender.ts';
import type { PushMessage, PushSender } from './sender.ts';

const message: PushMessage = {
  text: { title: '서버 작업 실패: 일일 정산', body: null },
  channel: 'ops',
};

const device = (id: string, pushToken = `token-${id}`): PushDevice => ({
  id,
  platform: 'ANDROID',
  pushToken,
});

// 비운 기기는 목록(토큰 있는 기기만)에서 빠진다.
function memoryStore(devices: PushDevice[]) {
  const rows = [...devices];
  const store: PushDeviceStore = {
    list: () => Promise.resolve([...rows]),
    clearToken: (id) => {
      rows.splice(
        rows.findIndex((d) => d.id === id),
        1,
      );
      return Promise.resolve();
    },
  };
  return { store, rows };
}

describe('broadcast', () => {
  it('모든 기기로 같은 메시지를 보낸다', async () => {
    const { store } = memoryStore([device('a'), device('b')]);
    const { sender, sent } = createFakeSender();

    const result = await broadcast({ store, sender }, message);

    expect(result).toEqual({ devices: 2, sent: 2, cleared: 0, failures: [] });
    expect(delivered(result)).toBe(true);
    expect(sent.map((s) => s.target.pushToken)).toEqual(['token-a', 'token-b']);
    expect(sent[0].message).toBe(message);
  });

  it('무효 토큰이면 그 기기의 토큰을 비우고 나머지는 보낸다', async () => {
    const { store, rows } = memoryStore([device('a'), device('b')]);
    const { sender } = createFakeSender({ 'token-a': { status: 'INVALID_TOKEN' } });

    const result = await broadcast({ store, sender }, message);

    expect(result).toEqual({ devices: 2, sent: 1, cleared: 1, failures: [] });
    expect(rows.map((d) => d.id)).toEqual(['b']);
  });

  it('실패한 기기는 사유를 모으고 토큰을 비우지 않는다. 발송기가 던져도 다음 기기로 간다', async () => {
    const { store, rows } = memoryStore([device('a'), device('b')]);
    const sender: PushSender = {
      send: (target) =>
        target.pushToken === 'token-a'
          ? Promise.resolve({ status: 'FAILED', error: 'UNAVAILABLE' })
          : Promise.reject(new Error('network down')),
    };

    const result = await broadcast({ store, sender }, message);

    expect(result).toEqual({
      devices: 2,
      sent: 0,
      cleared: 0,
      failures: ['ANDROID a: UNAVAILABLE', 'ANDROID b: network down'],
    });
    expect(delivered(result)).toBe(false);
    expect(rows).toHaveLength(2);
  });

  it('기기가 없으면 아무것도 보내지 않고 미전달이다', async () => {
    const { store } = memoryStore([]);
    const { sender, sent } = createFakeSender();

    const result = await broadcast({ store, sender }, message);

    expect(result).toEqual({ devices: 0, sent: 0, cleared: 0, failures: [] });
    expect(delivered(result)).toBe(false);
    expect(sent).toEqual([]);
  });
});

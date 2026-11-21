import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { clientIp } from './clientIp.ts';

const app = new Hono().get('/', (c) => c.text(clientIp(c)));

// node-server는 env.incoming(또는 env.server.incoming)의 소켓에서 주소를 읽는다
const socketEnv = (remoteAddress: string | undefined) => ({
  incoming: { socket: { remoteAddress, remotePort: 54321, remoteFamily: 'IPv4' } },
});

const ipOf = async (headers: Record<string, string>, env?: unknown) =>
  (await app.request('/', { headers }, env)).text();

describe('clientIp', () => {
  it('X-Forwarded-For가 여럿이면 가장 오른쪽 값(프록시가 붙인 값)을 공백 없이 쓴다', async () => {
    expect(
      await ipOf({ 'X-Forwarded-For': '6.6.6.6, 10.0.0.1 ,203.0.113.7 ' }, socketEnv('172.18.0.2')),
    ).toBe('203.0.113.7');
  });

  it('X-Forwarded-For 하나면 그 값이다', async () => {
    expect(await ipOf({ 'X-Forwarded-For': '203.0.113.7' })).toBe('203.0.113.7');
  });

  it('가장 오른쪽 값이 비어 있으면 소켓 주소로 돌아간다', async () => {
    expect(await ipOf({ 'X-Forwarded-For': '6.6.6.6, ' }, socketEnv('172.18.0.2'))).toBe(
      '172.18.0.2',
    );
  });

  it('X-Forwarded-For가 없으면 소켓 주소다', async () => {
    expect(await ipOf({}, socketEnv('127.0.0.1'))).toBe('127.0.0.1');
    expect(await ipOf({}, { server: socketEnv('::1') })).toBe('::1');
  });

  it('소켓 주소가 없거나 node 소켓이 아니면 unknown이다', async () => {
    expect(await ipOf({}, socketEnv(undefined))).toBe('unknown');
    // app.request처럼 env에 incoming이 없으면 getConnInfo가 던진다
    expect(await ipOf({})).toBe('unknown');
  });
});

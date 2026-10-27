import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

// prod는 Caddy가 X-Forwarded-For를 실제 클라이언트 IP로 덮어쓴다(trusted_proxies 미설정).
// 가장 오른쪽 값이 프록시가 붙인 값이라 위조할 수 없다. 프록시가 없는 dev는 소켓 주소를 쓴다.
export function clientIp(c: Context): string {
  const forwarded = c.req.header('X-Forwarded-For');
  if (forwarded) {
    const last = forwarded.split(',').at(-1)?.trim();
    if (last) return last;
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

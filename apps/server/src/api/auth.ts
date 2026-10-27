import { createHash, timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { ApiException } from './errors.ts';

export type AuthFailureLimit = {
  maxFailures: number;
  windowMs: number;
};

// 인증 실패 횟수 제한(D-036, D-059). IP별로 첫 실패부터 windowMs 안의 실패를 세고,
// maxFailures에 닿으면 그 창이 끝날 때까지 그 IP의 모든 요청을 막는다. 서버는 프로세스 하나라 메모리에 둔다.
export function createAuthFailureLimiter(limit: AuthFailureLimit, now: () => number = Date.now) {
  const failures = new Map<string, { count: number; resetAt: number }>();

  const current = (ip: string) => {
    const entry = failures.get(ip);
    if (entry && entry.resetAt <= now()) {
      failures.delete(ip);
      return undefined;
    }
    return entry;
  };

  return {
    isBlocked(ip: string): boolean {
      return (current(ip)?.count ?? 0) >= limit.maxFailures;
    },
    recordFailure(ip: string): void {
      const entry = current(ip);
      if (entry) entry.count += 1;
      else failures.set(ip, { count: 1, resetAt: now() + limit.windowMs });
    },
  };
}

export type AuthFailureLimiter = ReturnType<typeof createAuthFailureLimiter>;

const digest = (value: string) => createHash('sha256').update(value).digest();

// 길이가 달라도 같은 시간에 비교하도록 다이제스트끼리 비교한다.
export function tokenMatches(received: string, expected: string): boolean {
  return timingSafeEqual(digest(received), digest(expected));
}

export function bearerAuth(options: {
  token: string;
  limiter: AuthFailureLimiter;
  clientIp: (c: Parameters<MiddlewareHandler>[0]) => string;
}): MiddlewareHandler {
  return async (c, next) => {
    const ip = options.clientIp(c);
    if (options.limiter.isBlocked(ip)) {
      throw new ApiException('RATE_LIMITED', 'Too many failed authentication attempts');
    }
    const match = /^Bearer (.+)$/.exec(c.req.header('Authorization') ?? '');
    if (!match || !tokenMatches(match[1], options.token)) {
      options.limiter.recordFailure(ip);
      throw new ApiException('UNAUTHORIZED', 'Missing or invalid bearer token');
    }
    await next();
  };
}

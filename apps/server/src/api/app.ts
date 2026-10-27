import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bearerAuth, createAuthFailureLimiter } from './auth.ts';
import type { AuthFailureLimit } from './auth.ts';
import { clientIp as defaultClientIp } from './clientIp.ts';
import { ApiException } from './errors.ts';
import { fail, ok } from './response.ts';

export type AppOptions = {
  token: string;
  authFailureLimit?: AuthFailureLimit;
  now?: () => number;
  clientIp?: (c: Context) => string;
};

const DEFAULT_AUTH_FAILURE_LIMIT: AuthFailureLimit = { maxFailures: 10, windowMs: 15 * 60_000 };

export function createApp(options: AppOptions) {
  const limiter = createAuthFailureLimiter(
    options.authFailureLimit ?? DEFAULT_AUTH_FAILURE_LIMIT,
    options.now,
  );

  const app = new Hono();

  app.onError((error, c) => {
    if (error instanceof ApiException) return fail(c, error.code, error.message);
    // Hono 내부 오류(잘못된 JSON 본문 등)는 4xx를 검증 실패로 본다.
    if (error instanceof HTTPException && error.status < 500) {
      return fail(c, 'VALIDATION_FAILED', error.message);
    }
    // 스택 트레이스는 응답에 넣지 않고 로그에만 남긴다(D-042).
    console.error(error);
    return fail(c, 'INTERNAL', 'Internal server error');
  });

  app.notFound((c) => fail(c, 'NOT_FOUND', `No route for ${c.req.method} ${c.req.path}`));

  const v1 = new Hono();
  v1.get('/health', (c) => ok(c, { status: 'ok' }));
  v1.use(
    '*',
    bearerAuth({ token: options.token, limiter, clientIp: options.clientIp ?? defaultClientIp }),
  );

  app.route('/v1', v1);
  return app;
}

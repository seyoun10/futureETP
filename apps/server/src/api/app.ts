import { Hono } from 'hono';
import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { bearerAuth, createAuthFailureLimiter } from './auth.ts';
import type { AuthFailureLimit } from './auth.ts';
import { clientIp as defaultClientIp } from './clientIp.ts';
import { commoditiesRoutes } from './commodities.ts';
import type { CommoditiesStore } from './commodities.ts';
import { contractsRoutes } from './contracts.ts';
import type { ContractsStore } from './contracts.ts';
import { curveRoutes } from './curve.ts';
import type { CurveStore } from './curve.ts';
import { devicesRoutes } from './devices.ts';
import type { DevicesStore } from './devices.ts';
import { disparityRoutes } from './disparity.ts';
import type { DisparityStore } from './disparity.ts';
import { ApiException } from './errors.ts';
import { commodityEtpsRoutes, etpsRoutes } from './etps.ts';
import type { EtpsStore } from './etps.ts';
import { fail, ok } from './response.ts';
import { settingsRoutes } from './settings.ts';
import type { SettingsStore } from './settings.ts';

export type AppOptions = {
  token: string;
  // health에서 DB 연결을 확인한다. 실패하면 throw한다.
  checkDb: () => Promise<void>;
  settings: SettingsStore;
  commodities: CommoditiesStore;
  disparity: DisparityStore;
  curve: CurveStore;
  contracts: ContractsStore;
  devices: DevicesStore;
  etps: EtpsStore;
  dbCheckTimeoutMs?: number;
  authFailureLimit?: AuthFailureLimit;
  // 인증 실패 제한·조회 기준 시각(ms)
  now?: () => number;
  clientIp?: (c: Context) => string;
};

const DEFAULT_DB_CHECK_TIMEOUT_MS = 3000;
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
  // 배포 확인용. pg 풀은 연결 타임아웃이 없어 DB가 응답하지 않으면 멈추므로 시간을 제한한다.
  v1.get('/health', async (c) => {
    const timeoutMs = options.dbCheckTimeoutMs ?? DEFAULT_DB_CHECK_TIMEOUT_MS;
    let timer: NodeJS.Timeout | undefined;
    try {
      await Promise.race([
        options.checkDb(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`DB check timed out (${timeoutMs}ms)`)),
            timeoutMs,
          );
        }),
      ]);
    } catch (error) {
      console.error(error);
      throw new ApiException('INTERNAL', 'Database unavailable');
    } finally {
      clearTimeout(timer);
    }
    return ok(c, { status: 'ok' });
  });
  v1.use(
    '*',
    bearerAuth({ token: options.token, limiter, clientIp: options.clientIp ?? defaultClientIp }),
  );
  const now = () => new Date(options.now?.() ?? Date.now());
  v1.route('/settings', settingsRoutes(options.settings));
  v1.route('/devices', devicesRoutes(options.devices));
  v1.route('/commodities', commoditiesRoutes(options.commodities, options.settings, now));
  v1.route('/commodities', disparityRoutes(options.disparity, now));
  v1.route('/commodities', curveRoutes(options.curve, now));
  v1.route('/commodities', contractsRoutes(options.contracts, now));
  v1.route('/commodities', commodityEtpsRoutes(options.etps));
  v1.route('/etps', etpsRoutes(options.etps));

  app.route('/v1', v1);
  return app;
}

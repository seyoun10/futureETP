import { z } from 'zod';

// process.env는 이 파일에서만 읽는다(D-043). 값이 틀리면 시작하자마자 종료한다.
const optionalString = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production']),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  // 앱 접근 키(D-036, D-044). 키 생성 스크립트는 32바이트 이상을 만든다.
  API_TOKEN: z.string().min(32),
  SCHEDULER_ENABLED: z.stringbool(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  // 아래는 비워도 시작한다. 쓰는 작업이 실행될 때 없으면 그 작업이 실패한다.
  DATABENTO_API_KEY: optionalString,
  MASSIVE_API_KEY: optionalString,
  KRX_API_KEY: optionalString,
  FCM_SERVICE_ACCOUNT_PATH: optionalString,
  // Healthchecks.io 프로젝트 ping key. check slug는 작업 이름과 같다(D-045). 비우면 신호를 보내지 않는다.
  HEALTHCHECKS_PING_KEY: optionalString,
  BACKUP_DIR: optionalString,
});

export type Config = z.infer<typeof envSchema>;

export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    throw new Error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

function loadConfig(): Config {
  try {
    return parseConfig(process.env);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

export const config = loadConfig();

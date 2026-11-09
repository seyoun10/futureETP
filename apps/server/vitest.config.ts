import { configDefaults, defineConfig } from 'vitest/config';

// src/config.ts는 import 때 process.env를 검증하고 실패하면 exit 1 한다(D-053).
// config를 거쳐 import되는 모듈도 테스트할 수 있게 유효한 더미 값을 넣는다.
const env = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgres://localhost:5432/futureetp_test',
  API_TOKEN: 'test-token-0123456789abcdef0123456789',
  SCHEDULER_ENABLED: 'false',
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          exclude: [...configDefaults.exclude, 'src/**/*.db.test.ts'],
          env,
        },
      },
      {
        // 실제 PostgreSQL을 쓰는 통합 테스트. 같은 DB를 비우므로 파일을 순서대로 돌린다
        test: {
          name: 'db',
          include: ['src/**/*.db.test.ts'],
          fileParallelism: false,
          globalSetup: ['src/db/testDb.globalSetup.ts'],
          env: { ...env, DATABASE_URL: process.env.TEST_DATABASE_URL ?? env.DATABASE_URL },
        },
      },
    ],
  },
});

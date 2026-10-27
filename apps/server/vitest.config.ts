import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // src/config.ts는 import 때 process.env를 검증하고 실패하면 exit 1 한다(D-053).
    // config를 거쳐 import되는 모듈도 테스트할 수 있게 유효한 더미 값을 넣는다.
    env: {
      NODE_ENV: 'development',
      DATABASE_URL: 'postgres://localhost:5432/futureetp_test',
      API_TOKEN: 'test-token-0123456789abcdef0123456789',
      SCHEDULER_ENABLED: 'false',
    },
  },
});

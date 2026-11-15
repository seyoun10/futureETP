import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // `--coverage`로 돌 때(npm run check, D-127)만 적용된다. 하한은 측정값 내림이다.
    // 스키마 선언만 있는 파일은 앱·서버 테스트에서 쓰여 여기서는 0%라 lines는 낮게 둔다
    coverage: {
      include: ['src/**/*.ts'],
      reporter: ['text-summary'],
      exclude: ['src/**/*.test.ts'],
      thresholds: { lines: 75, statements: 75, functions: 90, branches: 90 },
    },
  },
});

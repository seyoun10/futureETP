// 앱·서버·공유 패키지 공통 lint 설정(D-038, D-054). 저장소 루트에서 `eslint .` 한 번으로 돈다.
import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/.expo/',
    'apps/mobile/android/',
    'apps/mobile/ios/',
    'apps/mobile/expo-env.d.ts',
    'apps/server/drizzle/',
  ]),

  // Expo 규칙(React·Hooks·import)은 앱에만 건다.
  ...expoConfig.map((config) => ({ ...config, basePath: 'apps/mobile' })),
  {
    basePath: 'apps/mobile',
    settings: {
      // 루트에서 실행하므로 앱 tsconfig를 지정해야 `@/` 경로 별칭을 푼다.
      'import/resolver': { typescript: { project: 'apps/mobile/tsconfig.json' } },
    },
  },

  {
    files: ['apps/server/**', 'packages/shared/**', 'scripts/**', '*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node },
  },

  // 타입 기반 규칙(no-floating-promises 등). 각 파일은 가장 가까운 tsconfig로 검사한다.
  {
    files: ['**/*.{ts,tsx}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // default export 금지(CLAUDE.md, D-029). route 파일과 도구 설정 파일만 예외다.
  {
    rules: {
      'no-restricted-exports': [
        'error',
        {
          restrictDefaultExports: {
            direct: true,
            named: true,
            defaultFrom: true,
            namedFrom: true,
            namespaceFrom: true,
          },
        },
      ],
    },
  },
  {
    files: ['apps/mobile/src/app/**', '**/*.config.{ts,js,mjs,cjs}'],
    rules: { 'no-restricted-exports': 'off' },
  },

  // 서식 규칙은 Prettier에 맡긴다. 마지막에 둬서 겹치는 규칙을 끈다.
  prettierConfig,
]);

// 앱·서버·공유 패키지 공통 lint 설정(D-038, D-054). 저장소 루트에서 `eslint .` 한 번으로 돈다.
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, globalIgnores } from 'eslint/config';
import expoConfig from 'eslint-config-expo/flat.js';
import prettierConfig from 'eslint-config-prettier/flat';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const mobileSrc = path.join(import.meta.dirname, 'apps/mobile/src');
const featuresDir = path.join(mobileSrc, 'features');
// src 바로 아래 폴더 중 route(app)·화면(features)을 뺀 나머지(api·charts·components·lib 등)
const mobileLowerLayers = fs
  .readdirSync(mobileSrc, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !['app', 'features'].includes(entry.name))
  .map((entry) => entry.name);
const mobileFeatures = fs
  .readdirSync(featuresDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

export default defineConfig([
  globalIgnores([
    '**/dist/',
    '**/.expo/',
    'apps/mobile/android/',
    'apps/mobile/ios/',
    'apps/mobile/expo-env.d.ts',
    'apps/server/drizzle/',
    // Claude Code가 만드는 git worktree(저장소 사본)
    '.claude/worktrees/',
  ]),

  // Expo 규칙(React·Hooks·import)은 앱에만 건다.
  ...expoConfig.map((config) => ({ ...config, basePath: 'apps/mobile' })),
  {
    basePath: 'apps/mobile',
    settings: {
      // 루트에서 실행하므로 앱 tsconfig를 지정해야 `@/` 경로 별칭을 푼다.
      'import/resolver': { typescript: { project: 'apps/mobile/tsconfig.json' } },
    },
    rules: {
      // feature끼리는 import하지 않는다. 함께 쓰게 되면 components·api·lib로 옮긴다(mobile.md)
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            ...mobileFeatures.map((feature) => ({
              target: path.join(featuresDir, feature),
              from: featuresDir,
              except: [`./${feature}`],
              message: '다른 feature를 import하지 않는다. components·api·lib로 옮긴다.',
            })),
            // 의존은 route(app) → 화면(features) → 하위 레이어 한 방향이다(D-041)
            {
              target: mobileLowerLayers.map((dir) => path.join(mobileSrc, dir)),
              from: [featuresDir, path.join(mobileSrc, 'app')],
              message:
                '하위 레이어는 features·app을 import하지 않는다. 필요한 것을 이 레이어로 옮긴다.',
            },
            {
              target: featuresDir,
              from: path.join(mobileSrc, 'app'),
              message: '화면은 route 파일(app)을 import하지 않는다.',
            },
          ],
        },
      ],
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
    rules: {
      // union(장 상태·에러 code 등)에 값이 늘면 빠진 case를 잡는다(D-127)
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      // 곧 없어질 API를 새로 쓰지 않는다. 불가피한 곳은 줄 단위 예외에 이유를 적는다(D-128)
      '@typescript-eslint/no-deprecated': 'error',
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

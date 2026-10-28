# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native 기반 Android/iOS 개인용 앱(사용자 본인 1명, 스토어 미배포, D-011). 서비스 상세는 `docs/product.md`

## Project status

futureETP: 2026-10-28 기준 5단계 개발 중. 5-1~5-3(서버 기반·calc·재계산·정산) 완료. 진행 중: 5-4 실데이터 검증(지수 재현 검증 완료, 다음: Massive 가입·실측), 5-5 앱 공통 기반(접근 키 기기 확인 남음), 5-6 화면 수직 슬라이스(C-a 이격도차트 에뮬레이터·실기기 확인 남음). 상세 진행 현황과 D-번호는 `TODO.md`

## Critical Rules

- 프로젝트 전용 규칙만 기재 (공통 규칙은 전역 `~/.claude/CLAUDE.md`)

## Docs

작업 전 관련 문서만 골라 읽는다 (항상 로드하지 않도록 `@` import 대신 경로로만 참조). 결정이 바뀌면 해당 문서도 함께 갱신한다.

- `TODO.md`: 단계별 진행 체크리스트
- `docs/product.md`: 서비스 기획 (개요, MVP 범위, 사용자 흐름, 데이터 모델, 외부 연동)
- `docs/data-model.md`: 서버 DB 논리 모델 (Mermaid erDiagram)
- `docs/wireframes/screens.md`: 화면 와이어프레임(ASCII)과 화면별 세부 동작
- `docs/tech-stack.md`: 확정된 기술 스택 (결과만)
- `docs/architecture.md`: 디렉터리 구조, 레이어, API/에러 규약, 환경 분리
- `docs/decisions.md`: 결정 기록과 근거 (D-xxx)
- `docs/research/`: Step 2 리서치 결과 (소스 비교, 비용, 출처)

## Tech Stack

상세·버전은 `docs/tech-stack.md`, 근거는 `docs/decisions.md`.

- 공통: Node 26(`.nvmrc`), npm, TypeScript ~6.0 strict(Expo SDK 고정 버전에 서버·shared도 맞춤) — D-028, D-050, D-051
- App: Expo SDK 58(RN 0.88, React 19.3, 개발 빌드, CNG: 네이티브 폴더 미커밋), Expo Router, TanStack Query + Zustand, StyleSheet + 테마 토큰(다크 전용), Victory Native XL + Skia, i18next(ko/en) — D-027~D-033
- Server: Node 타입 스트리핑으로 TS 직접 실행(빌드 없음) + Hono·zod·Drizzle 0.45(`pg`), 배치는 프로세스 내 croner(작업별 IANA 시간대), 앱과 npm workspaces로 공유 패키지 — D-034, D-035, D-051, D-053
- DB: PostgreSQL 18(dev는 Homebrew `postgresql@18`) — D-035, D-053
- Infra: Oracle Always Free ARM VM 1대 + Docker Compose + Caddy(HTTPS), Bearer 비밀 토큰 — D-034, D-036
- Push: FCM·APNs 직접 연동(Android 먼저) — D-037
- Test/Lint: jest-expo + RNTL 14(앱)·Vitest(서버·공유, 루트에 한 벌), ESLint 9(루트 설정 하나) + Prettier, pre-commit lint·format — D-038, D-054
- Build: Android 로컬 빌드(Zulu JDK 17, 에뮬레이터 `Pixel_API_36`), iOS는 Apple 가입 전 시뮬레이터만(CocoaPods), EAS Update — D-039, D-055

## Key Patterns

- 앱 API 호출은 `fetch` 래퍼 + TanStack Query, 에러는 `AppError` class로 통일 (D-030)
- 서버 상태는 TanStack Query, 기기별 UI 설정(언어·등락 색·기간 선택)만 Zustand persist (D-030, D-047)
- 차트에 쓰는 색은 테마 토큰에서, 등락 색은 표시 설정에서 읽는다 (D-031)
- 사용자에게 보이는 문구는 i18n 키로만 쓴다 (D-033)
- 서버 접근 키는 SecureStore에만 둔다. 앱 번들·app config·저장소에 넣지 않는다. 예외는 dev 변형의 `DEV_API_TOKEN`뿐 (D-043, D-044)
- 커밋 전 `npm run check`(타입 검사·lint·테스트) 통과 (D-038)
- 앱 테스트는 RNTL 14라 `await render(...)`로 쓴다 (D-054)
- 서버 `config`는 import 때 env를 검증하고 실패하면 exit 1. 테스트용 더미 env는 `apps/server/vitest.config.ts`의 `test.env`에 있다 (D-053, D-054)

## Coding Conventions
- component: PascalCase
- util/hook: camelCase
- commit message: Conventional Commits ('feat:', 'fix:', 'chore:')
- React component는 named export 사용 (default export 금지). 예외: `apps/mobile/src/app/` 아래 Expo Router route 파일(`_layout` 포함)은 default export만 하고, `src/app/` 밖의 named export 화면을 다시 내보내기만 한다 (D-029, D-050)
- 서버·shared는 ESM + Node 타입 스트리핑: 상대 import에 `.ts` 확장자, 타입만은 `import type`, TS `enum`·`namespace`·생성자 매개변수 속성 금지(enum 대신 shared 상수 문자열), tsconfig `paths` 별칭 금지(필요하면 `package.json` `imports`의 `#/`) (D-051)
- 앱은 `@/` = `apps/mobile/src/` 별칭을 쓴다 (D-050)
- 배치 작업은 `JobHandler(ctx)`로 만들어 `jobs/handlers.ts`의 `JOB_HANDLERS`에 등록한다. 시각은 `ctx.now`만 쓰고, 처리한 CME 거래일은 `ctx.tradeDate`에 채운다 (D-060)
- 서버 라우트는 `ok(c, data)`로 응답하고 실패는 `ApiException(code, message)`을 던진다(`onError`가 봉투로 바꿈, D-059)
- API 응답은 항상 `{ success: true, data } | { success: false, error: { code, message } }` + 맞는 HTTP 상태. 앱은 shared zod 스키마로 응답을 검증하고, 사용자 문구는 에러 `code`의 i18n 키로 만든다 (D-042)

## Architecture

<!-- 여러 파일을 읽어야 이해되는 큰 구조 -->
상세는 `docs/architecture.md`.

- npm workspaces: `apps/mobile`(Expo), `apps/server`(API + 배치 한 프로세스), `packages/shared`(zod 스키마·타입·푸시 문구만, TS 소스를 직접 `exports`). 의존은 앱·서버 → shared만 (D-040, D-051)
- 계산은 서버 `src/calc`(순수 함수)에만 둔다. 조회 API는 배치가 저장한 값을 읽기만 한다. 예외는 커브 조회(원천값 → calc 호출)와 C-a 조회(저장된 분포로 rare 레벨·꼬리 백분위·잠정 봉 calc 호출) (D-041, D-046, D-086)
- 앱: route → 화면(`src/features/`, named export) → query hook → `src/api`. 컴포넌트에서 `fetch` 직접 호출 금지 (D-041)
- 환경: dev는 로컬 Mac(스케줄러 꺼짐, 작업은 CLI 1회 실행), prod는 VM. 앱은 `APP_VARIANT`로 dev(`.dev` ID)·prod 두 변형. 서버는 `process.env`를 `src/config.ts`(zod 검증)에서만, 앱은 `extra`(서버 주소·dev 토큰)를 `src/api/config.ts`에서만 읽는다. `APP_VARIANT`가 `development`가 아니면 모두 prod (D-043, D-052)
- DB 마이그레이션: 생성은 dev의 `drizzle-kit generate`(`apps/server/drizzle/` 커밋), 적용은 코드 `migrate()`(`src/db/migrate.ts`) (D-053). 스키마는 `casing: 'snake_case'`(TS camelCase 속성 → snake_case 컬럼), enum 값은 text + shared·서버 상수 배열 (D-058)

## Domain Context

## Commands

모두 저장소 루트에서 실행한다. workspace 하나만 돌릴 때는 `-w apps/mobile`·`-w apps/server`·`-w packages/shared`.

- `npm run check`: 타입 검사 → lint → 포맷 확인 → 전체 테스트 (커밋 전 필수)
- `npm run lint` / `npm run format` / `npm run typecheck` / `npm test`
- 단일 테스트: 서버·공유(Vitest) `npm test -w apps/server -- src/config.test.ts -t "PORT"`, 앱(Jest) `npm test -w apps/mobile -- CommodityListScreen -t "렌더링"`
- pre-commit hook(husky + lint-staged)은 스테이징된 파일만 `eslint --fix` → `prettier --write`
- 앱: `npm run start -w apps/mobile`(dev 변형), `npm run android:dev -w apps/mobile`, `npm run ios:dev -w apps/mobile`
- 서버: `npm run dev -w apps/server`(`.env` 읽음, watch), `npm run db:generate -w apps/server`, `npm run db:migrate -w apps/server`, 작업 1회 실행 `npm run job -w apps/server -- <작업 이름> [기준 시각]`(D-060), 거래일 달력 입력 `npm run calendar:import -w apps/server -- <연도>`(`scripts/calendar/<연도>.json`, D-061), 전체 재계산 1회 실행 `npm run recompute -w apps/server -- [원자재 ...]`(D-070), Databento 1회 적재 `npm run databento:download -w apps/server -- [--yes] [--out <폴더>]`(기본은 견적만, `--yes`면 과금 다운로드) → `npm run databento:import -w apps/server -- [--dry-run] [--data <폴더>]`(D-088)
- 접근 키: 새 키·QR `npm run access-key`, 기존 키 QR `npm run access-key -- --show < 키 파일`(D-080)
- 운영(Mac, 설정은 `~/.config/futureetp/ops.env`): prod 배포 `npm run deploy`(D-048), VM 백업 내려받기 `npm run backup:pull`, dev DB에 덤프 복원 `npm run dev:restore -- [덤프 파일] [--yes]`(D-045), 첫 배포 뒤 빈 prod DB에 dev DB 넣기 `npm run prod:seed -- [--yes]`(D-100)

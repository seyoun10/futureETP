# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native 기반 Android/iOS 개인용 앱(사용자 본인 1명, 스토어 미배포, D-011). 서비스 상세는 `docs/product.md`. prod는 VM 배포·앱 OTA로 운영 중이고, 남은 단계·항목과 D-번호는 `TODO.md`

## Docs

작업 전 관련 문서만 골라 읽는다 (항상 로드하지 않도록 `@` import 대신 경로로만 참조). 결정이 바뀌면 해당 문서도 함께 갱신한다.

- `TODO.md`: 단계별 진행 체크리스트
- `docs/product.md`: 서비스 기획 (개요, MVP 범위, 용어, 계산 정의, 사용자 흐름, 외부 연동)
- `docs/data-model.md`: 서버 DB 논리 모델 (Mermaid erDiagram)
- `docs/wireframes/screens.md`: 화면 와이어프레임(ASCII)과 화면별 세부 동작
- `docs/tech-stack.md`: 확정된 기술 스택과 버전 (결과만)
- `docs/architecture.md`: 디렉터리 구조, 레이어, API/에러 규약, 환경 분리
- `docs/decisions.md`: 결정 기록과 근거 (D-xxx)
- `docs/ops.md`: 운영·기기 확인 명령 (배포, 백업, OTA, Android 배포, 접근 키, 성능 측정, 미러링)
- `docs/research/`: Step 2 리서치 결과 (소스 비교, 비용, 출처)

## Domain Context

용어 정의 전체는 `docs/product.md`의 "용어"·"계산 정의".

- CME 원자재 선물 데이터를 보는 앱. 모든 계산은 CME 공식 정산가(settlement) 기준이고, 날짜는 CME 거래일(미국 중부 17시에 바뀜)로 센다
- 화면: A 원자재 목록 → C 원자재 화면의 탭 C-a 이격도차트(기준값 지수·이평선·rare 레벨), C-b 월물커브(기준일 대비 비교일 커브·롤 수익률), C-c 월물차트(월물 5개 비교). 그 밖에 ETP 목록·상세, rare 레벨 도달 푸시 알림
- 장 상태는 장중/휴장/정산 대기. 정산 대기는 거래일이 바뀐 뒤 직전 거래일 정산 배치가 끝나기 전까지 (D-022)

## Tech Stack

버전은 `docs/tech-stack.md`, 근거는 `docs/decisions.md`. 여기에는 기본값과 달라 틀리기 쉬운 것만 둔다.

- TypeScript ~6.0 strict를 Expo SDK 고정 버전에 맞춰 서버·shared도 같이 쓴다 (D-028, D-050, D-051)
- App: Expo 개발 빌드 + CNG(네이티브 폴더 미커밋), Expo Router, TanStack Query + Zustand, StyleSheet + 테마 토큰(다크 전용), Victory Native XL + Skia, i18next(ko/en) (D-027~D-033)
- Server: Node 타입 스트리핑으로 TS 직접 실행(빌드 없음) + Hono·zod·Drizzle(`pg`), 배치는 프로세스 내 croner(작업별 IANA 시간대) (D-034, D-035, D-051, D-053)
- Infra: Oracle ARM VM 1대 + Docker Compose + Caddy, Bearer 비밀 토큰. Push는 FCM·APNs 직접(Android 먼저) (D-034, D-036, D-037)
- Test/Lint: jest-expo + RNTL 14(앱)·Vitest(서버·공유, 루트 한 벌), 서버 `*.db.test.ts`는 실제 PostgreSQL(`futureetp_test`, 로컬 서버 필요), ESLint 9 + Prettier(`*.md`는 포맷 제외) (D-038, D-054, D-126)
- Build: Android 로컬 빌드(Zulu JDK 17, 에뮬레이터 `Pixel_API_36`), iOS는 Apple 가입 전 시뮬레이터만 (D-039, D-055)

## Key Patterns

- 앱 API 호출은 `fetch` 래퍼 + TanStack Query, 에러는 `AppError` class로 통일 (D-030)
- 서버 상태는 TanStack Query, 기기별 UI 설정(언어·등락 색)만 Zustand persist (D-030, D-047). 예외: C 탭 하단 기준 시각 줄 전달용 비영속 `stores/footerFreshness`. C-a·C-c 기간은 원자재 스택의 화면 상태 (D-107)
- 차트에 쓰는 색은 테마 토큰에서, 등락 색은 표시 설정에서 읽는다 (D-031)
- 사용자에게 보이는 문구는 i18n 키로만 쓴다 (D-033)
- 서버 접근 키는 SecureStore에만 둔다. 앱 번들·app config·저장소에 넣지 않는다. 예외는 dev 변형의 `DEV_API_TOKEN`뿐 (D-043, D-044)
- 앱 테스트는 RNTL 14라 `await render(...)`로 쓴다 (D-054)
- 서버 `config`는 import 때 env를 검증하고 실패하면 exit 1. 테스트용 더미 env는 `apps/server/vitest.config.ts`의 `test.env`에 있다 (D-053, D-054)

### 서버 API

- 라우트는 `ok(c, data)`로 응답하고 실패는 `ApiException(code, message)`을 던진다(`onError`가 봉투로 바꿈, D-059)
- 응답은 항상 `{ success: true, data } | { success: false, error: { code, message } }` + 맞는 HTTP 상태. 앱은 shared zod 스키마로 응답을 검증하고, 사용자 문구는 에러 `code`의 i18n 키로 만든다 (D-042)

## Coding Conventions

- component: PascalCase
- util/hook: camelCase
- commit message: Conventional Commits ('feat:', 'fix:', 'chore:')
- 커밋 전 `npm run check` 통과 (D-038)
- `fix:` 커밋은 회귀 테스트를 함께 넣는다. 시각 조정만 예외로, 기기 확인으로 대신한다
- React component는 named export 사용 (default export 금지). 예외: `apps/mobile/src/app/` 아래 Expo Router route 파일(`_layout` 포함)은 default export만 하고, `src/app/` 밖의 named export 화면을 다시 내보내기만 한다 (D-029, D-050)
- 서버·shared는 ESM + Node 타입 스트리핑: 상대 import에 `.ts` 확장자, 타입만은 `import type`, TS `enum`·`namespace`·생성자 매개변수 속성 금지(enum 대신 shared 상수 문자열), tsconfig `paths` 별칭 금지(필요하면 `package.json` `imports`의 `#/`) (D-051)
- 앱은 `@/` = `apps/mobile/src/` 별칭을 쓴다 (D-050)
- 배치 작업은 `JobHandler(ctx)`로 만들어 `jobs/handlers.ts`의 `JOB_HANDLERS`에 등록한다. 시각은 `ctx.now`만 쓰고, 처리한 CME 거래일은 `ctx.tradeDate`에 채운다 (D-060)

## Architecture

상세는 `docs/architecture.md`.

- npm workspaces: `apps/mobile`(Expo), `apps/server`(API + 배치 한 프로세스), `packages/shared`(zod 스키마·타입·푸시 문구만, TS 소스를 직접 `exports`). 의존은 앱·서버 → shared만 (D-040, D-051)
- 계산은 서버 `src/calc`(순수 함수)에만 둔다. 조회 API는 배치가 저장한 값을 읽기만 한다. 예외는 커브 조회(원천값 → calc 호출)와 C-a 조회(저장된 분포로 rare 레벨·꼬리 백분위·잠정 봉 calc 호출) (D-041, D-046, D-086)
- 앱: route → 화면(`src/features/`, named export) → query hook → `src/api`. 컴포넌트에서 `fetch` 직접 호출 금지 (D-041)
- 환경: dev는 로컬 Mac(스케줄러 꺼짐, 작업은 CLI 1회 실행), prod는 VM. 앱은 `APP_VARIANT`로 dev(`.dev` ID)·prod 두 변형. 서버는 `process.env`를 `src/config.ts`(zod 검증)에서만, 앱은 `extra`(서버 주소·dev 토큰)를 `src/api/config.ts`에서만 읽는다. `APP_VARIANT`가 `development`가 아니면 모두 prod (D-043, D-052)
- DB 마이그레이션: 생성은 dev의 `drizzle-kit generate`(`apps/server/drizzle/` 커밋), 적용은 코드 `migrate()`(`src/db/migrate.ts`) (D-053). 스키마는 `casing: 'snake_case'`(TS camelCase 속성 → snake_case 컬럼), enum 값은 text + shared·서버 상수 배열 (D-058)

## Claude Code 설정

- Stop hook(`.claude/hooks/typecheck-changed.sh`)이 응답을 마칠 때 변경된 workspace만 타입 검사하고 실패하면 되돌려 준다(D-057). 중간 확인용 typecheck는 따로 돌리지 않아도 된다
- 프로젝트 agent: 코드 탐색 `code-searcher`, 검사 실행 `test-runner`, calc 검토 `calc-reviewer`, 문서 갱신 초안 `docs-sync`
- 프로젝트 skill: 배포 절차 `/release`(사용자가 부를 때만), 실기기 화면·성능 확인 `device-check`

## Commands

모두 저장소 루트에서 실행한다. workspace 하나만 돌릴 때는 `-w apps/mobile`·`-w apps/server`·`-w packages/shared`. 운영·배포·기기 확인 명령은 `docs/ops.md`.

- `npm run check`: 타입 검사 → lint → 포맷 확인 → 전체 테스트
- `npm run lint` / `npm run format` / `npm run typecheck` / `npm test`
- 커버리지 측정(추세 확인용, 임계치 없음): `npm run test:coverage`
- 단일 테스트: 서버·공유(Vitest) `npm test -w apps/server -- src/config.test.ts -t "PORT"`, 앱(Jest) `npm test -w apps/mobile -- CommodityListScreen -t "렌더링"`
- pre-commit hook(husky + lint-staged)은 스테이징된 파일만 `eslint --fix` → `prettier --write`
- 앱: `npm run start -w apps/mobile`(dev 변형), `npm run android:dev -w apps/mobile`, `npm run ios:dev -w apps/mobile`. gradle을 직접 부를 때는 `APP_VARIANT=development`를 붙인다
- 앱 OTA: `npm run update:prod`. `apps/mobile/package.json`의 `scripts`·의존성을 바꾸면 fingerprint가 바뀌어 설치된 빌드가 OTA를 못 받는다(새로 빌드 필요)
- 서버: `npm run dev -w apps/server`(`.env` 읽음, watch), `npm run db:generate -w apps/server`, `npm run db:migrate -w apps/server`
- 작업 1회 실행 `npm run job -w apps/server -- <작업 이름> [기준 시각]`(D-060), 거래일 달력 입력 `npm run calendar:import -w apps/server -- <연도>`(`scripts/calendar/<연도>.json`, D-061), 전체 재계산 `npm run recompute -w apps/server -- [원자재 ...]`(D-070)

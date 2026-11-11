---
paths:
  - 'apps/server/**'
  - 'packages/shared/**'
---

# 서버(apps/server)·공유(packages/shared) 규칙

## Stack

- Node 타입 스트리핑으로 TS 직접 실행(빌드 없음) + Hono·zod·Drizzle(`pg`), 배치는 프로세스 내 croner(작업별 IANA 시간대) (D-034, D-035, D-051, D-053)
- Test: Vitest(루트 한 벌). `*.db.test.ts`는 실제 PostgreSQL(`futureetp_test`, 로컬 서버 필요) (D-054, D-126)

## Architecture

- 계산은 `src/calc`(순수 함수)에만 둔다. 조회 API는 배치가 저장한 값을 읽기만 한다. 예외는 커브 조회(원천값 → calc 호출)와 C-a 조회(저장된 분포로 rare 레벨·꼬리 백분위·잠정 봉 calc 호출) (D-041, D-046, D-086)
- `process.env`는 `src/config.ts`(zod 검증)에서만 읽는다. import 때 검증하고 실패하면 exit 1. 테스트용 더미 env는 `apps/server/vitest.config.ts`의 `test.env`에 있다 (D-043, D-053, D-054)
- DB 마이그레이션: 생성은 dev의 `drizzle-kit generate`(`apps/server/drizzle/` 커밋), 적용은 코드 `migrate()`(`src/db/migrate.ts`) (D-053). 스키마는 `casing: 'snake_case'`(TS camelCase 속성 → snake_case 컬럼), enum 값은 text + shared·서버 상수 배열 (D-058)
- shared는 zod 스키마·타입·푸시 문구만 두고 TS 소스를 직접 `exports`한다 (D-040, D-051)

## Conventions

- ESM + Node 타입 스트리핑: 상대 import에 `.ts` 확장자, 타입만은 `import type`, TS `enum`·`namespace`·생성자 매개변수 속성 금지(enum 대신 shared 상수 문자열), tsconfig `paths` 별칭 금지(필요하면 `package.json` `imports`의 `#/`) (D-051)
- 라우트는 `ok(c, data)`로 응답하고 실패는 `ApiException(code, message)`을 던진다(`onError`가 봉투로 바꿈, D-059)
- 배치 작업은 `JobHandler(ctx)`로 만들어 `jobs/handlers.ts`의 `JOB_HANDLERS`에 등록한다. 시각은 `ctx.now`만 쓰고, 처리한 CME 거래일은 `ctx.tradeDate`에 채운다 (D-060)

## Commands

- `npm run dev -w apps/server`(`.env` 읽음, watch), `npm run db:generate -w apps/server`, `npm run db:migrate -w apps/server`
- 단일 테스트: `npm test -w apps/server -- src/config.test.ts -t "PORT"`
- 작업 1회 실행 `npm run job -w apps/server -- <작업 이름> [기준 시각]`(D-060), 거래일 달력 입력 `npm run calendar:import -w apps/server -- <연도>`(`scripts/calendar/<연도>.json`, D-061), 전체 재계산 `npm run recompute -w apps/server -- [원자재 ...]`(D-070)

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

React Native 기반 Android/iOS 개인용 앱(사용자 본인 1명, 스토어 미배포, D-011). 서비스 상세는 `docs/product.md`. prod는 VM 배포·앱 OTA로 운영 중이고, 남은 단계·항목과 D-번호는 `TODO.md`

## 영역별 규칙

앱·서버 전용 규칙은 해당 경로의 파일을 다룰 때 자동으로 로드된다. 파일을 아직 열지 않은 설계 단계에서는 직접 읽는다.

- `.claude/rules/mobile.md`: `apps/mobile` (스택, 레이어, 상태·i18n·SecureStore, export 규칙, 앱 명령)
- `.claude/rules/server.md`: `apps/server`·`packages/shared` (calc 원칙, config, 마이그레이션, ESM·타입 스트리핑, 라우트·배치 규약, 서버 명령)

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

## Architecture

상세는 `docs/architecture.md`, 스택·버전은 `docs/tech-stack.md`.

- npm workspaces: `apps/mobile`(Expo), `apps/server`(API + 배치 한 프로세스), `packages/shared`. 의존은 앱·서버 → shared만 (D-040, D-051)
- TypeScript ~6.0 strict를 Expo SDK 고정 버전에 맞춰 서버·shared도 같이 쓴다 (D-028, D-050, D-051)
- 환경: dev는 로컬 Mac(스케줄러 꺼짐, 작업은 CLI 1회 실행), prod는 VM(Docker Compose + Caddy). 앱은 `APP_VARIANT`로 dev(`.dev` ID)·prod 두 변형이고, `development`가 아니면 모두 prod (D-034, D-043, D-052)
- API 응답은 항상 `{ success: true, data } | { success: false, error: { code, message } }` + 맞는 HTTP 상태. 앱은 shared zod 스키마로 응답을 검증하고, 사용자 문구는 에러 `code`의 i18n 키로 만든다 (D-042)

## Conventions

- commit message: Conventional Commits ('feat:', 'fix:', 'chore:')
- 커밋 전 `npm run check` 통과 (D-038)
- `fix:` 커밋은 회귀 테스트를 함께 넣는다. 시각 조정만 예외로, 기기 확인으로 대신한다
- ESLint 9(루트 설정 하나) + Prettier. `*.md`는 Prettier 포맷 제외 (D-038, D-054)

## Claude Code 설정

- Stop hook(`.claude/hooks/typecheck-changed.sh`)이 응답을 마칠 때 변경된 workspace만 타입 검사하고 실패하면 되돌려 준다(D-057). 중간 확인용 typecheck는 따로 돌리지 않아도 된다
- 프로젝트 agent: 코드 탐색 `code-searcher`, 검사 실행 `test-runner`, calc 검토 `calc-reviewer`, 문서 갱신 초안 `docs-sync`
- 프로젝트 skill: 배포 절차 `/release`(사용자가 부를 때만), 실기기 화면·성능 확인 `device-check`

## Commands

모두 저장소 루트에서 실행한다. workspace 하나만 돌릴 때는 `-w apps/mobile`·`-w apps/server`·`-w packages/shared`. 영역별 명령은 각 rules 파일, 운영·배포·기기 확인 명령은 `docs/ops.md`.

- `npm run check`: 타입 검사 → lint → 포맷 확인 → 전체 테스트
- `npm run lint` / `npm run format`(파일 수정, 확인만은 `npm run format:check`) / `npm run typecheck` / `npm test`
- 커버리지 측정(추세 확인용, 임계치 없음): `npm run test:coverage`
- pre-commit hook(husky + lint-staged)은 스테이징된 파일만 `eslint --fix` → `prettier --write`

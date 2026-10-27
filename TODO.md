# TODO

목표: React Native로 Android/iOS 개인용 앱 개발(스토어 미배포, D-011)
지침: 이 파일 내용을 순차적으로 진행하면서 이후 내용을 적절하게 업데이트

## 1. 앱 서비스 기획
Claude가 이후 작업할 때 참고하는 문서. 기술 결정의 입력이 된다.

- [x] 서비스 개요: 목적, 대상 사용자, 핵심 가치
- [x] 핵심 기능 목록 및 MVP 범위
- [x] 사용자 흐름(user flow) / 화면 목록
- [x] 화면 와이어프레임 (`docs/wireframes/screens.md`)
- [x] Step 1 역검증 (2026-10-22 완료): `docs/product.md`, `docs/wireframes/screens.md`를 항목별로 사용자와 확인하고 문서에 반영. 결정 근거는 `docs/decisions.md` D-001~D-002
  - 교차 검증 (2026-10-22 완료): 문서 간 불일치·공백·예시 수치를 고치고 미기록 결정을 D-003~D-009로 소급 기록
  - 기획 근거(계획 원본, 저장소 밖): `~/.claude/plans/todo-md-recursive-milner.md`. 일부 내용이 낡았으므로 `docs/product.md`를 우선한다
- [x] 데이터 모델 초안 (주요 엔티티와 관계) — Step 2: `docs/data-model.md`, 결정 근거 D-010. 리서치 의존 필드는 문서 끝 "리서치 후 확정할 항목"에서 마저 정한다
- [x] 외부 연동 요구사항 (인증, 결제, 푸시, 외부 API 등) — Step 2 (2026-10-22 완료)
  - Step 2 리서치 진행 순서: ①시세 소스 → ②CME 달력 → ③롤 규칙 → ④ETP 소스 → ⑤외부 연동 문서화
  - ① 시세 소스 (2026-10-22 완료, `docs/research/market-data.md`): 개인용 앱 전환(D-011), 비용 $0 구성과 장중 15분 주기(D-012). 가입 후 확인할 것은 개발 단계로 미룸: Databento 적재 견적, Massive Basic 정산가 필드, Databento·Massive 정산가 일치 여부
  - ② CME 달력 (2026-10-22 완료, `docs/research/cme-calendar.md`): 휴장·조기 마감·공휴일 중간 정지, 최종 거래일 규칙(소스의 계약 정의 값 저장), 금속 상장·활성 월물
  - ③ 롤 규칙 (2026-10-22 완료, `docs/research/roll-rules.md`, D-013): 한국형은 네 원자재 모두 S&P GSCI 일정, 미국형은 CL BCBCLI·나머지 BCOM. 금·은은 두 규칙이 같음(화면에 "한국형과 같음" 안내, D-014). 국내 ETN 확인은 ④에서 완료
  - ④ ETP 소스 (2026-10-22 완료, `docs/research/etp-sources.md`): 국내 ETN 기초지수 계열 4개 모두 GSCI 일정 확인. 미국 GC에 DB 금 ETN 3종 추가 발견 → 최소 순자산(D-015)·미국 반자동 분류(D-016). 남은 것: KRX Open API 인증키로 ETN 만기일·기초지수 필드 확인(개발 단계)
  - Step 2 리서치 남은 항목 (2026-10-22 완료, `docs/research/curve-settlement.md`): 커브 거래량 기준(20거래일 평균 100계약, 최대 24개, D-018), 일일 정산 18:30 CT(D-019, Massive 반영 시각은 개발 단계 실측), C-b 기준일 하한 = 일봉 적재 시작일(D-020), B 데이터 출처 문구(`docs/wireframes/screens.md`)
  - ⑤ 외부 연동 문서화 (2026-10-22 완료, `docs/product.md` 외부 연동 요구사항)
  - Step 2 데이터 모델 반영(2026-10-22 완료, `docs/data-model.md`): 사용자 시간대(IANA)·언어, 알림 거부 시간, 보류 알림, 알림 발송 기록(중복 방지 키, D-006), 기기별 푸시 토큰, ETP와 ETN 시리즈, 활성 월물 달력, 거래 달력(휴장·조기 마감). D-011로 사용자 테이블을 단일 행 `app_settings`로 정리
  - Step 2 산출물: 데이터 모델(Mermaid erDiagram), 외부 연동, `docs/research/`, `docs/decisions.md` D-010~
  - Step 2 교차 검증 (2026-10-22 완료): 예시 수치·낡은 문구·단계 체크리스트 정리. 설계 공백은 D-022(정산 대기)·D-023(푸시 실패)·D-024(다수 판정 변경)·D-025(ETP 새 후보 알림)·D-026(커브 M1 앞 월물, 거부 시간 경계)으로 결정

## 2. Tech Stack 결정
기획(1)의 기능 요구사항을 기준으로 결정한다.

- [x] 프레임워크 구성: Expo + CNG (2026-10-23, D-027)
- [x] 언어 / 패키지 매니저: TypeScript(strict) + npm (2026-10-23, D-028)
- [x] 내비게이션: Expo Router, route 파일만 default export 예외 (2026-10-23, D-029)
- [x] 상태 관리, 데이터 패칭: TanStack Query + Zustand (2026-10-23, D-030)
- [x] UI / 스타일링, 차트, i18n: StyleSheet + 테마 토큰, Victory Native XL(스파이크로 검증), i18next (2026-10-23, D-031~D-033)
- [x] Backend / DB / 서버 접근 보호, 배치 스케줄러·호스팅: TypeScript + PostgreSQL, Oracle Always Free VM + croner, HTTPS + Bearer 토큰 (2026-10-23, D-034~D-036)
- [x] 푸시: FCM·APNs 직접 연동, Android 먼저·APNs는 Apple 가입 뒤 (2026-10-23, D-037)
- [x] 테스트 도구, lint / format: ESLint + Prettier, jest-expo + Vitest, pre-commit lint·format (2026-10-23, D-038)
- [x] 빌드 / 설치: Android 로컬 빌드(EAS 예비), iOS는 Apple 가입 전 시뮬레이터만, EAS Update, CI는 원격 저장소 생성 때, 서버는 스크립트 배포 (2026-10-23, D-039)
- [x] 결정된 스택 기준으로 CLAUDE.md Tech Stack / Key Patterns / Coding Conventions 정리 (2026-10-23). API 응답 형태는 3단계에서 확정

## 3. Architecture 결정
- [x] 디렉터리 구조: `apps/mobile`·`apps/server`·`packages/shared`(API 계약만) (2026-10-27, D-040)
- [x] 레이어 구성: 앱 route·UI·상태·데이터 접근, 서버 진입점(api·jobs) → calc·sources·push·db (2026-10-27, D-041)
- [x] API 통신 및 에러 처리 규약: 응답 봉투 + HTTP 상태, 앱 zod 검증, freshness로 자동 새로고침 (2026-10-27, D-042)
- [x] 환경 설정 분리: dev는 로컬 Mac(스케줄러 꺼짐·prod 덤프 복원), prod는 VM, 앱은 `APP_VARIANT` 두 변형 (2026-10-27, D-043)
- [x] 1단계에서 미룬 항목 (2026-10-27): 접근 키 첫 실행 QR·붙여넣기 + SecureStore(D-044), 운영 푸시 + Healthchecks.io·매일 덤프 + Mac 내려받기(D-045), 차트 전체 1회 로딩·스냅숏 90일·커브 조회 시 calc(D-046)
- [x] 3단계 교차 검증 (2026-10-27): 문서 간 불일치 정리(D-047), 설계 공백 7건 결정(D-048), 심볼 표준형(D-049)·흩어진 후속 항목을 4·5단계로 모음

## 4. 프로젝트 생성
- [x] git init 및 .gitignore (스캐폴딩 시 생성되는 .gitignore와 병합 필요)
- [x] 프로젝트 스캐폴딩 (2026-10-27). 결정 기록에 흩어진 "스캐폴딩 때 확인" 항목:
  - [x] Expo 지원 Node 버전 확인 후 `.nvmrc`·`engines` 고정 (D-028) → Node 26 (D-050)
  - [x] `victory-native` 43.x peerDependencies 수정판 확인, 없으면 42.x 고정 (D-032) → 42.0.1, 설치는 C-a 스파이크 때 (D-050)
  - [x] `create-expo-app` 템플릿의 route 폴더 위치(`app/`/`src/app/`), React Native 중복 설치 시 npm `overrides` (D-040) → `src/app/`, 루트 `overrides`로 react·react-native 고정 (D-050)
  - [x] 서버 실행 방식(Node 타입 스트리핑 / tsdown 번들)과 shared TS 소스 직접 참조 호환성 (D-040) → 타입 스트리핑, `packages/shared`·`apps/server` 최소 골격 생성 (D-051)
  - [x] 기본 앱 ID 확정(`io.github.seyoon.futureetp`, D-050 완료), `app.config.ts`의 `APP_VARIANT` 두 변형과 prebuild·빌드 스크립트 (D-043) → D-052
  - [x] `eas update`가 로컬 `.env`를 읽는지, EAS 환경 변수(`--environment`)가 필요한지 (D-043) → `--environment` 필수, 주면 `.env` 무시 (D-052)
  - [x] 서버 환경 변수 이름 확정, `config.ts` zod 검증, `.env.example` (D-043) → D-053
  - [x] Drizzle 마이그레이션 실행 방식(`drizzle-kit migrate` / 코드의 `migrate()`) (D-048) → 생성은 drizzle-kit, 적용은 코드 `migrate()`, 로컬 Postgres 18 설치 (D-053)
- [x] lint / format / test 설정 (2026-10-27, D-054)
  - [x] Vitest(서버·공유) + `parseConfig`·`envelopeSchema` 테스트 + 루트 `npm run check`
  - [x] ESLint + Prettier (루트 설정 하나, ESLint 9)
  - [x] jest-expo + RNTL(앱)
  - [x] husky + lint-staged pre-commit
- [x] Android Studio(SDK·에뮬레이터)·JDK 설치 (2026-10-27, D-055)
- [x] Android 에뮬레이터 / iOS 시뮬레이터에서 실행 확인 (2026-10-27, D-055)
  - [x] Android 에뮬레이터: dev 변형 빌드·설치·실행 (2026-10-27, D-055)
  - [x] iOS 시뮬레이터: CocoaPods 설치, iPhone 17(iOS 27.1)에서 dev 변형 빌드·설치·실행
- [x] CLAUDE.md 갱신 (Tech Stack, Architecture, Commands, 2026-10-27): D-050~D-055 결과(버전, 서버 ESM import 규칙, `@/` 별칭, 변형·`extra` 읽는 곳, 마이그레이션, RNTL `await render`) 반영
- [x] SessionStart hook(~/.claude/hooks/dev-env.sh, 기존 swift-env.sh에서 이름 변경)에 Node 버전 주입 추가 (package.json 존재 시, 2026-10-27): Node·npm·`.nvmrc`·macOS·Xcode 버전 한 줄

## 5. 개발
순서 원칙: 서버 기반 → calc(TDD) → 실데이터 적재·검증 → 화면별 수직 슬라이스(API + 화면) → 장중·알림 → ETP → 운영·배포. 각 항목이 커밋 단위이고, 끝날 때마다 `npm run check` 후 커밋한다. 5-2~5-3은 외부 가입 없이 진행하고, 5-5(앱 기반)는 Databento 적재(5-4)를 기다리는 동안 병행할 수 있다.

- [x] 첫 작업: C-a 차트 스파이크(D-032) — log 축, x축만 핀치, 보이는 봉 기준 y 자동 맞춤, 봉 4,000개 성능, 십자선 스냅 햅틱 (2026-10-27, D-056: 통과, Victory Native XL 유지)
  - [ ] 수동 확인: 에뮬레이터에서 핀치 확대·축소(Option + 드래그), 실기기에서 햅틱 촉감·성능 (D-056)
  - 본 구현에 넘길 것: y축 특수 라벨(현재가 회색·이평선 노랑·rare-level 10개 보라 순위 색)은 기본 눈금과 다른 색으로 쓰고, 겹치면 기본 눈금 텍스트를 숨긴다(십자선 라벨과 같은 방식, rare-level 선·라벨은 기능 구현 때 적용). 한글 글꼴 번들(`useFont`) 또는 Skia Paragraph, '전체'에서 이동 제스처 막기, 스파이크 화면(`src/features/chart-spike/`, `src/app/dev/`)은 C-a 본 구현 뒤 삭제 (D-056)
- [x] 5단계 개발 세부 항목 정리 (2026-10-27, 이 목록)
- [x] 개발 전략 확정 (2026-10-27, D-057): 단일 세션 + Stop hook 타입 검사, 서브에이전트는 calc 테스트 작성·단계 끝 리뷰에만

### 5-1. 서버 기반
- [x] DB 스키마: 영역 1~3·5·6 Drizzle 정의 + 첫 마이그레이션 + `app_settings` 기본 행 (ETP 테이블은 5-9에서) (2026-10-27, D-058)
- [x] Hono 앱 골격: 응답 봉투·`onError`·`notFound`, Bearer 검사·인증 실패 횟수 제한, `GET /v1/health`, 라우트 테스트(`app.request`) (2026-10-27, D-059)
- [x] 배치 러너: `batch_run` 기록·1회 재시도·`npm run job -- <이름> [기준 시각]` CLI, croner 등록(`SCHEDULER_ENABLED`) (2026-10-27, D-060)
- [x] 시장 기준 데이터: `commodity`·`active_month_rule` 시드 마이그레이션, `trading_day` 생성 함수 + `calendar:import` CLI(2026·2027 입력), 표준 심볼 유틸(D-049) (2026-10-27, D-061)
  - [ ] CME 2027 공식 휴일 공지가 나오면 `scripts/calendar/2027.json` 대조

### 5-2. calc 순수 함수 (Vitest, product.md 계산 정의를 테스트로 먼저)
- [x] 거래일·장 상태: CME 거래일 판정, 장중/휴장/정산 대기, `nextUpdateAt` (2026-10-27, D-062)
  - [ ] 장중 수집기 구현 뒤 `INTRADAY_EXPECTED_MS`(임시 5분) 실측으로 조정
- [x] 월물 목록: 대상 월물, 만기순 5개 + 대표월물 6번째 (금속 활성 월물) (2026-10-27, D-063)
- [x] 대표월물 전환: 전일 거래량, 되돌아가지 않음, 최종 거래일 안전장치 (2026-10-27, D-064)
- [x] 롤 비중: `roll_rule.params` 펼치기 — GSCI·BCOM·BCBCLI(1/3 leg·재조정·수량 drift) (2026-10-27, D-065)
  - [x] `ROLL_RULE_SEEDS`로 `roll_rule` 8행 넣기(마이그레이션 0003, D-070)
  - [ ] 5-4 지수 재현 검증 때 `NYSE_ONLY_CLOSED`·BCBCLI 첫날 수량 확인
- [x] 수익률 연결 지수: OHLC 근사, 혼합 가격 0 이하 산출 불가·이어 붙이기, 가격 수준 맞춤 비율 (2026-10-27, D-066)
  - [x] FRONT `roll_weight` 행 t = `nextFrontSymbol(t)`(다음 거래일 대표월물)로 넣기(`buildFrontAfterClose`, D-070)
- [x] 이평선·이격도·분포: 초기 기간 제외, 선형 보간 백분위, 실제 사용 기간, rare-level 선, 가까운 꼬리 백분위 표시값 (2026-10-27, D-067)
- [x] 커브: 월물 선택(20거래일 평균 100계약, 최대 24, M1·M2 포함, M1 앞 월물, D-018·D-026), 변화율, 스프레드, 연환산 롤 수익률 (2026-10-27, D-068)
- [x] 알림 판정: 고가·저가 이격도, 가장 드문 레벨 1건, 중복 방지 키, 거부 시간(자정 넘김·경계)·보류·지연 발송 선택, 실패 재시도 규칙 (2026-10-27, D-069)
  - [ ] 5-8에서 `INTRADAY`·`DEFERRED_PUSH` 모두 `RETRY` 재시도(`planRetries`), 기준값 없는 원자재는 대표월물 키로 판정

### 5-3. 일일 정산 흐름 (가짜 소스로)
- [x] 재계산 파이프라인: `daily_bar` → 대표월물·`roll_weight` → `index_bar`·`index_scale` → `disparity`·`disparity_distribution` (원자재·기준값 단위 전체 재계산 함수, D-024 규칙 변경 때도 사용) (2026-10-27, D-070)
- [x] `DAILY_SETTLE` 작업: ① 당일 저장·재계산·정산 대기 해제(밀린 거래일 따라잡기) ② `SETTLE_REVISION` 전일 정정 확인, ② 실패 시 알림 판정 중지 (2026-10-27, D-071)

### 5-4. 실데이터 적재와 검증 (외부 가입 필요)
- [ ] **[다음 작업 — 가입 필요, 기다리는 동안 5-5]** Databento 가입·적재 견적 → `scripts/` 1회 적재(만기 월물 포함 2010-06~, 심볼 변환) → `trading_day` 과거 행 생성·`pandas_market_calendars` 대조 (D-020, D-048)
- [ ] 적재 데이터로 전체 재계산 실행, 결과 점검(롤 구간·산출 불가 2020-04 등)
- [ ] 지수 재현 검증(D-048): 한국형·미국형 지수 일일 수익률을 대표 ETP(KODEX WTI원유선물(H), UCO·BOIL 등 1x 환산)와 비교
- [ ] Massive Basic 가입·실측: 정산가 필드·반영 시각·티커 형식·여러 월물 일괄 조회, Databento와 정산가 일치 → Massive 수집기(`SettlementSource`) + `DAILY_SETTLE`·`SETTLE_REVISION` 실소스 연결(`handlers.ts`의 prod 소스, D-071)
  - [ ] 18:30 CT에 일부 월물 정산가가 빠지는지 실측(① 부분 응답 허용, D-071)

### 5-5. 앱 공통 기반 (5-4와 병행 가능)
- [x] `src/api`: `fetch` 래퍼·`AppError`·query client(재시도 규칙)·query key, shared 스키마 검증 (2026-10-27, D-072)
- [x] 테마 토큰·등락 색, i18n(ko/en, `errors.<code>`), Zustand persist 표시 설정 (2026-10-27, D-073)
  - [x] 5-6 B 화면에서 언어 변경을 서버 설정(푸시 문구용)에도 PATCH (2026-10-27, D-082)
- [x] 라우트 골격: A, C 하단 탭(C-a~C-d)·`etp/[id]`, B·B-a·B-b·데이터 출처, 가로 전환 (D-047)
  - [x] 라우트·placeholder 화면·C title-bar·하단 탭·이동 테스트 (2026-10-27, D-074)
  - [x] [⟲] 가로 전환(C-a~C-c, ETP 탭에서 세로 복귀, 가로에서 title-bar·tab-bar 높이 줄임) (2026-10-27, D-076)
    - [ ] 재빌드 후 Android 기기에서 전환·세로 복귀·가로 높이 확인
- [x] 공용 UI: 기준 시각 줄(freshness), 로딩·오류·[다시 시도] 화면, `nextUpdateAt` 자동 새로고침 hook (2026-10-27, D-075)
  - [ ] 5-6 A 연결 때 Hermes 실기기에서 기준 시각 줄 표시(`formatToParts`) 확인
- [ ] 접근 키 B-b: QR(`futureetp-key:v1:`)·붙여넣기, `GET /v1/settings`로 확인 후 SecureStore, `UNAUTHORIZED` 시 B-b 이동, `scripts/` 키 생성·QR (D-044)
  - [x] SecureStore 저장·붙여넣기 입력·첫 실행 B-b(키 없으면 스택 대신)·B 목록 `설정됨` (2026-10-27, D-077)
    - [x] 키 확인 응답을 설정 스키마로 (2026-10-27, D-081)
    - [ ] 앱(dev 변형 아닌 저장 키)에서 dev 서버로 키 확인: 기기 확인 때
  - [x] QR 읽기(`expo-camera`, 권한 거부·카메라 없음 안내) (2026-10-27, D-078)
    - [ ] 재빌드 후 Android 기기에서 권한 요청·QR 읽기 확인
  - [x] `UNAUTHORIZED` 시 어느 화면에서든 B-b로 이동 + 오류 줄 (2026-10-27, D-079)
  - [x] `scripts/` 키 생성·QR 표시(`npm run access-key`, 기존 키는 `--show`에 stdin) (2026-10-27, D-080)

### 5-6. 화면 수직 슬라이스 (API + 화면 + 테스트)
- [x] 설정: `GET·PATCH /v1/settings`(rare 레벨 검증·정렬, 시간대·언어), B 화면, 데이터 출처 화면
  - [x] `GET·PATCH /v1/settings` + shared 스키마(rare 레벨 검증·정렬, 거부 시간, 시간대 IANA) + 앱 `getSettings`·`patchSettings` (2026-10-27, D-081)
  - [x] B 화면(이격도차트 설정·언어 PATCH·등락 색), 앱 실행 때 시간대 PATCH
    - [x] 언어·등락 색·기준값·이평선·분포 기간·알림 행(낙관적 PATCH, 실패 시 되돌림·오류 줄) (2026-10-27, D-082)
    - [x] rare-level 입력(범위 안내·오류·저장 막기·정렬) (2026-10-27, D-083)
    - [x] 앱 실행 때 시간대 PATCH(설정 조회마다 비교, 시간대당 1회) (2026-10-27, D-084)
  - [x] 데이터 출처 화면(screens.md 문구, ko·en) (2026-10-27)
    - [ ] 기기에서 긴 값 줄바꿈·가로 화면 확인
- [ ] A 원자재 목록: `GET /v1/commodities` + 화면(당겨서 새로고침, 대표월물·알림 표시)
- [ ] C-a 이격도차트: `GET /v1/commodities/:code/disparity`(기준값 없는 원자재 대체 표시 포함) + 차트 본 구현(스파이크 이관, `src/charts/`), 롤 마커·음영, rare-level 밴드·특수 라벨, 십자선 상세, 기간 버튼(Zustand), 스파이크 삭제
- [ ] C-b 월물커브: `GET /v1/commodities/:code/curve`(조회 시 calc, D-046) + 화면(기준일 −/+/0, 날짜 시트·휴장일 직전 거래일, D-021)
- [ ] C-c 월물차트: `GET /v1/commodities/:code/contracts` + 화면(C-a 차트 공용 부품 재사용)

### 5-7. 장중 배치
- [ ] Yahoo 실측: 다중 심볼 quote·당일 고가·저가 누적 시작 시각(17:00 CT 여부)·지연 시각 → 호출 전략 결정
- [ ] `INTRADAY` 작업: `intraday_snapshot`·`index_snapshot`(이평선 4종 이격도), 정산 대기·휴장 중지, 응답 형식 검증 실패 = 배치 실패
- [ ] A·C freshness 장중 값·오늘 잠정 봉 반영 확인

### 5-8. 알림
- [ ] 첫 푸시 준비: Firebase 프로젝트(두 package 등록)·`google-services.json`·서비스 계정 키 (D-037)
- [ ] 기기 등록: 앱 `push/`(토큰·플랫폼·시간대) + `PUT /v1/devices`, 무효 토큰 자동 삭제
- [ ] 발송: `push/` FCM 발송 인터페이스(APNs는 Apple 가입 뒤), shared 푸시 문구(ko/en), Android 채널(시세·`ops`)
- [ ] `INTRADAY`에 판정·발송 연결(`alert_record` 중복 방지·보류) + `DEFERRED_PUSH` 작업(30분)
- [ ] B-a 알림 설정 화면(대상·현재 레벨 요약·거부 시간·권한 상태·안내 문구), 알림 탭 → A → C-a 스택

### 5-9. ETP
- [ ] ETP 스키마(`etp_product`·`etp_series`) + KRX Open API 가입·ETN 만기일·기초지수 필드 확인
- [ ] 국내 수집기(네이버·`siseJson`·KRX): 종목명 파싱(배수·환헤지·시리즈), 시리즈 묶기, 상장폐지 처리
- [ ] 미국 수집기(Nasdaq·Yahoo) + 매핑표(D-016), 새 후보 1회 알림(D-025), 최소 순자산(D-015)
- [ ] `ETP` 작업: 순자산·평균 거래대금(D-017), 다수 판정 재계산·변경 알림(D-024)
- [ ] `GET /v1/commodities/:code/etps`·`GET /v1/etps/:id` + C-d(필터 4종·정렬 3종)·C-d-a 화면

### 5-10. 운영과 첫 배포
- [ ] `CALENDAR` 작업(60일 공백 점검), `BACKUP` 작업(`pg_dump`·7개 보관·보관 기간 행 정리, D-045, D-046), 운영 알림(거래일당 1회, D-048), Healthchecks.io ping
- [ ] 첫 서버 배포 전: Oracle VM 생성·PAYG 전환(D-034), 도메인(무료 DDNS / 저가 도메인, D-036), Caddy·방화벽(VM 보안 목록과 OS 방화벽의 80·443), Docker 로그 크기 제한, Healthchecks.io check(D-045)
- [ ] `infra/`(Dockerfile·compose·Caddyfile) + 배포 스크립트(rsync → 빌드 → 덤프 → 마이그레이션 → 교체, D-048), 백업 내려받기·dev 복원 스크립트
- [ ] 첫 서버 배포 때 `app.config.ts`의 `PROD_API_URL`(`futureetp.invalid`)을 실제 도메인으로 교체 (D-052)
- [ ] release APK 첫 빌드 때: 서명 키(keystore) 생성과 저장소 밖 백업 (D-039), Expo 계정·`eas init`·expo-updates 설치(`updates.url`·`runtimeVersion` fingerprint·채널 헤더) (D-052)
  - [ ] R8 축소 확인: dev 실행 logcat에 `ExpoModulesV2` 경고 — `expo.modules.sqlite.SQLAction`이 `Enumerable`을 구현하지 않아 release 빌드가 실패하거나 enum 이름이 JS로 넘어갈 수 있음. 빌드 성공과 표시 설정 저장·복원 동작 확인, 문제면 expo-sqlite 업데이트 또는 ProGuard keep 규칙 (D-073)
- [ ] 원격 저장소 생성 및 연결 (GitHub, private) 후 push: 앱을 기기에 설치해 쓸 수 있는 시점에 진행 (2026-10-22 결정). 이때 GitHub Actions로 `npm run check` CI 추가 (D-039)
- [ ] Apple Developer 가입(최대한 늦게) 뒤: iOS 실기기 설치 방식 결정, APNs 발송 경로 추가 (D-037, D-039)

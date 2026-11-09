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
  - [x] iOS 실기기: iPhone 14 Pro에 무료 Personal Team 서명으로 dev 변형 설치·실행(푸시 권한 빼고 빌드, 7일마다 재설치) (2026-10-30, D-039 보충)
- [x] CLAUDE.md 갱신 (Tech Stack, Architecture, Commands, 2026-10-27): D-050~D-055 결과(버전, 서버 ESM import 규칙, `@/` 별칭, 변형·`extra` 읽는 곳, 마이그레이션, RNTL `await render`) 반영
- [x] SessionStart hook(~/.claude/hooks/dev-env.sh, 기존 swift-env.sh에서 이름 변경)에 Node 버전 주입 추가 (package.json 존재 시, 2026-10-27): Node·npm·`.nvmrc`·macOS·Xcode 버전 한 줄

## 5. 개발
순서 원칙: 서버 기반 → calc(TDD) → 실데이터 적재·검증 → 화면별 수직 슬라이스(API + 화면) → 장중·알림 → ETP → 운영·배포. 각 항목이 커밋 단위이고, 끝날 때마다 `npm run check` 후 커밋한다. 5-2~5-3은 외부 가입 없이 진행하고, 5-5(앱 기반)는 Databento 적재(5-4)를 기다리는 동안 병행할 수 있다.

- [x] 첫 작업: C-a 차트 스파이크(D-032) — log 축, x축만 핀치, 보이는 봉 기준 y 자동 맞춤, 봉 4,000개 성능, 십자선 스냅 햅틱 (2026-10-27, D-056: 통과, Victory Native XL 유지)
  - [x] 수동 확인: 에뮬레이터에서 핀치 확대·축소(Option + 드래그), 실기기에서 햅틱 촉감·성능 (D-056) (2026-10-31)
    - iPhone 14 Pro(2026-10-30): 핀치 때 화면이 튀던 것은 핀치·드래그를 직접 구현해 고침(D-056 보충)
    - iPhone 14 Pro(2026-10-31, 운영 번들, CL): 십자선 햅틱 촉감 적당. FPS는 아래 `CandleChart` 항목
  - 본 구현에 넘길 것: y축 특수 라벨(현재가 회색·이평선 노랑·rare-level 10개 보라 순위 색)은 기본 눈금과 다른 색으로 쓰고, 겹치면 기본 눈금 텍스트를 숨긴다(십자선 라벨과 같은 방식, rare-level 선·라벨은 기능 구현 때 적용). 한글 글꼴 번들(`useFont`) 또는 Skia Paragraph, '전체'에서 이동 제스처 막기, 스파이크 화면(`src/features/chart-spike/`, `src/app/dev/`)은 C-a 본 구현 뒤 삭제 (D-056)
- [x] 5단계 개발 세부 항목 정리 (2026-10-27, 이 목록)
- [x] 개발 전략 확정 (2026-10-27, D-057): 단일 세션 + Stop hook 타입 검사, 서브에이전트는 calc 테스트 작성·단계 끝 리뷰에만

### 5-1. 서버 기반
- [x] DB 스키마: 영역 1~3·5·6 Drizzle 정의 + 첫 마이그레이션 + `app_settings` 기본 행 (ETP 테이블은 5-9에서) (2026-10-27, D-058)
- [x] Hono 앱 골격: 응답 봉투·`onError`·`notFound`, Bearer 검사·인증 실패 횟수 제한, `GET /v1/health`, 라우트 테스트(`app.request`) (2026-10-27, D-059)
- [x] 배치 러너: `batch_run` 기록·1회 재시도·`npm run job -- <이름> [기준 시각]` CLI, croner 등록(`SCHEDULER_ENABLED`) (2026-10-27, D-060)
- [x] 시장 기준 데이터: `commodity`·`active_month_rule` 시드 마이그레이션, `trading_day` 생성 함수 + `calendar:import` CLI(2026·2027 입력), 표준 심볼 유틸(D-049) (2026-10-27, D-061)
  - [ ] CME 2027 공식 휴일 공지가 나오면 `scripts/calendar/2027.json` 대조
    - 2026-11-02 확인: CME 공식 2027 달력은 아직 받지 못함(cmegroup.com이 스크립트 접근에 403). 제3자 달력(financecalendar.com)의 2027 휴일 날짜 11개는 `2027.json`과 모두 같음. 다만 에너지 시각은 없고 일부는 "Schedule not verified" 표시라 시각(13:30·12:00·12:45)은 미확인. CME 휴일 공지(보통 휴일 2주 전)로 첫 휴일 2027-01-01 전에 다시 대조

### 5-2. calc 순수 함수 (Vitest, product.md 계산 정의를 테스트로 먼저)
- [x] 거래일·장 상태: CME 거래일 판정, 장중/휴장/정산 대기, `nextUpdateAt` (2026-10-27, D-062)
  - [x] 장중 수집기 구현 뒤 `INTRADAY_EXPECTED_MS`(임시 5분) 실측으로 조정 (2026-10-30, dev 실측 7.4초·5.2초 → 1분, D-062)
- [x] 월물 목록: 대상 월물, 만기순 5개 + 대표월물 6번째 (금속 활성 월물) (2026-10-27, D-063)
- [x] 대표월물 전환: 전일 거래량, 되돌아가지 않음, 최종 거래일 안전장치 (2026-10-27, D-064)
- [x] 롤 비중: `roll_rule.params` 펼치기 — GSCI·BCOM·BCBCLI(1/3 leg·재조정·수량 drift) (2026-10-27, D-065)
  - [x] `ROLL_RULE_SEEDS`로 `roll_rule` 8행 넣기(마이그레이션 0003, D-070)
  - [x] 5-4 지수 재현 검증 때 `NYSE_ONLY_CLOSED`·BCBCLI 첫날 수량 확인 (2026-10-28, D-089: BCBCLI 수량 일치, NYSE 예외는 종가로 판별 불가해 방법론대로 유지)
- [x] 수익률 연결 지수: OHLC 근사, 혼합 가격 0 이하 산출 불가·이어 붙이기, 가격 수준 맞춤 비율 (2026-10-27, D-066)
  - [x] FRONT `roll_weight` 행 t = `nextFrontSymbol(t)`(다음 거래일 대표월물)로 넣기(`buildFrontAfterClose`, D-070)
- [x] 이평선·이격도·분포: 초기 기간 제외, 선형 보간 백분위, 실제 사용 기간, rare-level 선, 가까운 꼬리 백분위 표시값 (2026-10-27, D-067)
- [x] 커브: 월물 선택(20거래일 평균 100계약, 최대 24, M1·M2 포함, M1 앞 월물, D-018·D-026), 변화율, 스프레드, 연환산 롤 수익률 (2026-10-27, D-068)
- [x] 알림 판정: 고가·저가 이격도, 가장 드문 레벨 1건, 중복 방지 키, 거부 시간(자정 넘김·경계)·보류·지연 발송 선택, 실패 재시도 규칙 (2026-10-27, D-069)
  - [x] 5-8에서 `INTRADAY`·`DEFERRED_PUSH` 모두 `RETRY` 재시도(`planRetries`) (기준값 없는 원자재의 대표월물 판정·`INTRADAY`·`DEFERRED_PUSH` 재시도는 2026-10-28 완료)

### 5-3. 일일 정산 흐름 (가짜 소스로)
- [x] 재계산 파이프라인: `daily_bar` → 대표월물·`roll_weight` → `index_bar`·`index_scale` → `disparity`·`disparity_distribution` (원자재·기준값 단위 전체 재계산 함수, D-024 규칙 변경 때도 사용) (2026-10-27, D-070)
- [x] `DAILY_SETTLE` 작업: ① 당일 저장·재계산·정산 대기 해제(밀린 거래일 따라잡기) ② `SETTLE_REVISION` 전일 정정 확인, ② 실패 시 알림 판정 중지 (2026-10-27, D-071)

### 5-4. 실데이터 적재와 검증 (외부 가입 필요)
- [x] Databento 가입·적재 견적 → 1회 적재(만기 월물 포함 2010-06~, 심볼 변환) → `trading_day` 과거 행 생성·`pandas_market_calendars` 대조 (D-020, D-048, D-088)
  - [x] 가입·다운로드·변환 규칙·적재 CLI(`databento:import`), dev DB 1차 적재 (2026-10-28, D-088)
  - [x] CL·NG 연도 2자리 심볼 다운로드·다시 적재(NG 2025-06~ 채움) (2026-10-28, D-088)
  - [x] `pandas_market_calendars` 대조: 휴장일 재전송 9일 제외, Databento 공백 5거래일은 뺀 채 둠 (2026-10-28, D-088)
- [x] 적재 데이터로 전체 재계산 실행, 결과 점검: ts_ref가 과거로 되돌아간 정산 메시지 버림(CLK20 2020-04-17 수정), 산출 불가일 0 (2026-10-28, D-088)
- [x] 지수 재현 검증(D-048): 한국형·미국형 지수 일일 수익률을 대표 ETP(KODEX WTI원유선물(H), UCO·BOIL 등 1x 환산)와 비교 (2026-10-28, D-089: 미국형 3규칙 ProShares NAV와 일치, 금·은 한국형은 미국형으로 대신)
  - [x] 한국형 CL·NG: KRX Open API 인증키 발급 뒤 KODEX WTI원유선물(H) NAV 이력으로 다시 비교(종가로는 FRONT와 구분 안 됨) (2026-10-28, KRX가 주는 S&P GSCI 지수 값으로 CL·GC·SI KR 일치, NG는 비교 대상 없음, D-089)
    - [x] `NYSE_ONLY_CLOSED`에서 2025-01-09 빼기(S&P가 그날 계산·롤함, 2018-12-05는 지금대로) 후 재계산 (2026-10-28)
- [x] Massive Basic 가입·실측: 정산가 필드·반영 시각·티커 형식·여러 월물 일괄 조회, Databento와 정산가 일치 → Massive 수집기(`SettlementSource`) + `DAILY_SETTLE`·`SETTLE_REVISION` 실소스 연결(`handlers.ts`의 prod 소스, D-071)
  - [x] 가입·필드·티커 형식·일괄 조회·Databento 정산가 일치 실측 (2026-10-28, `docs/research/market-data.md`: 정산가 일치, 월물별 1회, 거래 없는 날 봉 없음, 거래량 기준 다름)
  - [x] Massive 수집기(`sources/massiveSettlement.ts`) + `DAILY_SETTLE`·`SETTLE_REVISION` 연결(prod·키 있는 dev), 가까운 26개 제한, 정정은 같은 소스 일봉만 (2026-10-28, D-095)
  - [x] 정산가 반영 시각 실측: 대표월물 13:00~13:35 CT 반영, 17:00 CT 뒤 드문 월물 봉이 다음 세션으로 넘어가 18:30 실행은 26개 중 일부만 받음 → 정산 16:05 CT로 당김 (2026-10-29, D-101)
    - [x] 2026-10-29 16:05 CT `DAILY_SETTLE` 실행: GC 13·SI 9·CL 19·NG 25개 저장, 빠진 38개는 10/30에도 Massive에 봉 없음(그날 거래 없음) → 받을 수 있는 봉은 모두 받음 (2026-10-30, D-101 확정)
    - [x] 사라진 10/28 봉 관찰: 7개(NGZ27·NGF28·NGN27·SIF7·GCF7·CLZ8·GCV6)가 10/29 12:24 CT까지 다시 나오지 않음 → dev DB 10/28 빠진 월물은 채울 값 없음. 재시도가 17:00을 넘긴 날은 일부만 저장되는 위험으로 남김(D-101) (2026-10-30). 11/02에는 다시 나와 있었음 → 주말 보충으로 채움(D-110)
  - [x] 수집 범위·거래량 기준 결정: 가까운 26개, 거래 없는 날 봉 없음, 거래량 기준 그대로 (2026-10-28, D-095)
- [ ] 정산 소요 단축: 드문 먼 월물 평일 건너뛰기 + 토요일 `SETTLE_BACKFILL` 보충 (D-110)
  - [x] `SETTLE_BACKFILL` 작업(월물마다 1회 `fetchRecentBars`, 빠진 칸만 채우고 채운 원자재만 재계산)·토요일 10:00 CT 트리거 (2026-11-03)
    - [x] dev 실제 Massive 1회: 빈 칸 155개 중 9개 채움(10/27·10/28 18:30 실행 손실분), 12분 39초
  - [x] `DAILY_SETTLE` 건너뛰기: 직전 10거래일 지금 소스 봉 없는 월물 제외, 가까운 2개·대상 월물 5개 보호 (2026-11-03)
  - [x] Healthchecks.io check `settle_backfill`(토요일 10:00 CT, 여유 60분, `healthchecks-setup.sh`에 추가) 만들기. 작업은 11/04 배포(`5f5eef7`)에 이미 포함돼 재배포 불필요 (2026-11-04)
  - [x] prod `SETTLE_REVISION`(11/02분) 실패 대응: 다음 날 Massive에서 사라진 드문 월물(CLQ27) 때문에 알림 판정이 멈춤 → 보호 월물만 빠졌을 때 실패, 나머지는 로그만, prod 배포 `67d7fa4` (2026-11-04, D-110)
  - [x] 위 변경 리뷰 수정: 보호 월물이 빠져도 받은 정정은 반영한 뒤 실패, 응답이 비면 실패, 봉 캐시는 그날 정산가가 있을 때만 재사용, prod 배포 `37b07ec` (2026-11-09, D-110)
  - [x] `SETTLE_REVISION` 실패 기준을 그날 지수에 쓴 월물(`roll_weight`)로 변경, prod 배포 `69db2ef` (2026-11-09, D-110)
  - [x] prod `SETTLE_REVISION` 11/04·11/05분 수동 복구로 알림 판정 중지 해제. 봉 117행의 거래량·OHLC가 바뀌고 정산가는 그대로 (2026-11-09, D-110)
  - [ ] 새 기준의 첫 정기 `SETTLE_REVISION`(11/09 16:05 CT 시작, 11/06분) 결과 확인
  - [x] `SETTLE_REVISION` 지수 월물 판정에 전 거래일 비중 포함 (2026-11-09, D-110, prod 미배포)
  - [x] `SETTLE_BACKFILL`이 저장된 봉도 다시 받은 값과 비교해 고침 (2026-11-09, D-110, prod 미배포)
  - [x] `SETTLE_BACKFILL` 재시도가 직전 실패 뒤 재계산을 복구 (2026-11-09, D-110, prod 미배포)
  - [ ] 첫 토요일 보충 로그(채운 봉 수)와 건너뛰기 시작 뒤(prod Massive 정산일 10거래일, 11/09 무렵) 평일 소요 실측 → `SETTLE_STEP1_EXPECTED_MS` 조정

### 5-5. 앱 공통 기반 (5-4와 병행 가능)
- [x] `src/api`: `fetch` 래퍼·`AppError`·query client(재시도 규칙)·query key, shared 스키마 검증 (2026-10-27, D-072)
- [x] 테마 토큰·등락 색, i18n(ko/en, `errors.<code>`), Zustand persist 표시 설정 (2026-10-27, D-073)
  - [x] 5-6 B 화면에서 언어 변경을 서버 설정(푸시 문구용)에도 PATCH (2026-10-27, D-082)
- [x] 라우트 골격: A, C 하단 탭(C-a~C-d)·`etp/[id]`, B·B-a·B-b·데이터 출처, 가로 전환 (D-047)
  - [x] 라우트·placeholder 화면·C title-bar·하단 탭·이동 테스트 (2026-10-27, D-074)
  - [x] [⟲] 가로 전환(C-a~C-c, ETP 탭에서 세로 복귀, 가로에서 title-bar·tab-bar 높이 줄임) (2026-10-27, D-076)
    - [ ] 재빌드 후 Android 기기에서 전환·세로 복귀·가로 높이 확인
- [x] 공용 UI: 기준 시각 줄(freshness), 로딩·오류·[다시 시도] 화면, `nextUpdateAt` 자동 새로고침 hook (2026-10-27, D-075)
  - [x] 5-6 A 연결 때 Hermes 실기기에서 기준 시각 줄 표시(`formatToParts`) 확인 (2026-10-30, iPhone 14 Pro. 줄을 화면 맨 아래(tab-bar 아래)로 옮기고 높이를 줄임)
- [ ] 접근 키 B-b: QR(`futureetp-key:v1:`)·붙여넣기, `GET /v1/settings`로 확인 후 SecureStore, `UNAUTHORIZED` 시 B-b 이동, `scripts/` 키 생성·QR (D-044)
  - [x] SecureStore 저장·붙여넣기 입력·첫 실행 B-b(키 없으면 스택 대신)·B 목록 `설정됨` (2026-10-27, D-077)
    - [x] 키 확인 응답을 설정 스키마로 (2026-10-27, D-081)
    - [x] 앱(dev 변형 아닌 저장 키)에서 dev 서버로 키 확인: 기기 확인 때 (2026-10-31, iPhone 14 Pro, `DEV_API_TOKEN` 없이 Metro 실행: 저장 키로 접속 → 서버 키 교체 뒤 당겨서 새로고침에 B-b 자동 이동·거절 줄 → QR로 새 키 저장 뒤 목록 복귀. 거절 줄은 가운데 정렬·빨간색(`colors.error`)으로 바꿈. dev 키가 48자라 앱 형식(43자, D-044)으로 넣을 수 없어 `npm run access-key` 키로 교체)
  - [x] QR 읽기(`expo-camera`, 권한 거부·카메라 없음 안내) (2026-10-27, D-078)
    - [ ] 재빌드 후 Android 기기에서 권한 요청·QR 읽기 확인
    - [ ] iOS 재빌드 뒤 실기기에서 권한 문구(기기 언어 ko·en, `locales`)·QR 읽기 확인
      - QR 읽기 확인(2026-10-31, iPhone 14 Pro). 권한 문구는 이미 허용된 기기라 못 봄: 앱 삭제 후 재설치 때 확인
  - [x] `UNAUTHORIZED` 시 어느 화면에서든 B-b로 이동 + 오류 줄 (2026-10-27, D-079)
  - [x] `scripts/` 키 생성·QR 표시(`npm run access-key`, 기존 키는 `--show`에 stdin) (2026-10-27, D-080)

### 5-6. 화면 수직 슬라이스 (API + 화면 + 테스트)
- [x] 설정: `GET·PATCH /v1/settings`(rare 레벨 검증·정렬, 시간대·언어), B 화면, 데이터 출처 화면
  - [x] `GET·PATCH /v1/settings` + shared 스키마(rare 레벨 검증·정렬, 거부 시간, 시간대 IANA) + 앱 `getSettings`·`patchSettings` (2026-10-27, D-081)
  - [x] B 화면(이격도차트 설정·언어 PATCH·등락 색), 앱 실행 때 시간대 PATCH
    - [x] 언어·등락 색·기준값·이평선·분포 기간·알림 행(낙관적 PATCH, 실패 시 되돌림·오류 줄) (2026-10-27, D-082)
    - [x] rare-level 입력(범위 안내·오류·저장 막기·정렬) (2026-10-27, D-083)
      - [x] 실기기 피드백 반영(2026-10-30): 키패드가 닫힐 때 한 번에 검증·저장(칸마다 저장해 입력 중 정렬로 값이 바뀌던 문제), 화면 끌기·[완료] 줄(iOS, 직접 그림)로 닫기, 설정 행마다 설명 줄
      - [x] 실기기에서 [완료] 줄이 키패드 바로 위에 붙는지 다시 확인(`InputAccessoryView` 대체 뒤) (2026-11-03, iPhone 14 Pro OTA 뒤: 가운데 [완료] 1개. 키패드가 올라오는 동안 줄이 먼저 떠 보여 `keyboardDidShow` 뒤에 150ms 페이드 인으로 보이게 바꿈 → 다음 OTA 뒤 확인)
        - 기기 확인(2026-11-03, iPhone 14 Pro): [완료] 줄은 키패드 위에 붙지만, 그 아래 RN 기본 툴바의 영어 "Done"(iOS 26 유리 버튼)이 함께 떠 버튼이 2개. `returnKeyType="done"`이 숫자 키패드에 RN 툴바를 붙이는 조건이라 iOS에서는 빼고(Android만 유지), [완료]는 가운데 정렬. 다음 iOS 빌드나 OTA 뒤 버튼 1개·가운데 확인
        - 미러링 확인(2026-11-03, prod): 입력 종료 때 정렬 저장(1·20·4·8·16 → 1·4·8·16·20)·범위 밖(60) 오류 줄·저장 막기 정상. 미러링은 Mac 키보드라 키패드가 안 떠 [완료] 줄은 기기 손으로 확인
    - [x] 앱 실행 때 시간대 PATCH(설정 조회마다 비교, 시간대당 1회) (2026-10-27, D-084)
  - [x] 데이터 출처 화면(screens.md 문구, ko·en) (2026-10-27)
    - [x] 기기에서 긴 값 줄바꿈·가로 화면 확인 (2026-11-03, iPhone 미러링 prod: ko·en 모두 한 줄에 들어감. 데이터 출처는 세로 잠금 화면(D-076)이라 가로 없음)
- [x] A 원자재 목록: `GET /v1/commodities` + 화면(당겨서 새로고침, 대표월물·알림 표시)
  - [x] `GET /v1/commodities` + shared 스키마(기준 거래일·대표월물·표시 값 우선순위·freshness) (2026-10-27, D-085)
    - [x] 5-4 적재 뒤 dev DB에서 실제 값으로 확인: 원자재마다 5개 월물·대표월물 1개, 가격·전일 대비 정상, CL만 알림 표시, GCQ27 거래 없음 표시. 응답 3.4KB·63ms (2026-10-28 21:30 CT)
  - [x] A 화면(목록·● 대표월물·🔔·거래 없음·당겨서 새로고침·자동 새로고침, C-a 이동) (2026-10-27)
    - [ ] 기기에서 열 너비·긴 가격(천 단위)·당겨서 새로고침 확인(5-4 적재 뒤 실제 값)
      - 에뮬레이터 확인(2026-10-29, en): 열 너비·천 단위 가격(4,065.1)·거래 없음·당겨서 새로고침 정상. 실기기 남음
- [ ] C-a 이격도차트: `GET /v1/commodities/:code/disparity`(기준값 없는 원자재 대체 표시 포함) + 차트 본 구현(스파이크 이관, `src/charts/`), 롤 마커·음영, rare-level 밴드·특수 라벨, 십자선 상세, 기간 버튼(Zustand), 스파이크 삭제
  - [x] `GET /v1/commodities/:code/disparity?basis&ma&window&levels` + shared 스키마(맞춤 비율·보유 월물·잠정 봉·rare 레벨·꼬리 백분위·대체) (2026-10-27, D-086)
    - [x] 5-4 적재 뒤 dev DB에서 실제 값·응답 크기·앱 파싱 시간 확인(행 객체 유지 여부, D-046) (2026-10-29)
      - 서버 측 실측(2026-10-28): 원자재 4개 × 기준값 3개 모두 200, 봉 4,125개, 응답 약 1.03MB(dev 서버는 압축 없음), 서버 처리 30~60ms. gzip 264KB로 D-046 가정(약 100KB)의 2.6배. 소수점 끝자리(부동소수 17자리)가 주원인이라 가격·이평선 4자리·이격도 3자리로 반올림하면 gzip 125KB. Node의 JSON.parse + zod 8~15ms. → 서버에서 가격은 표시 자릿수+2·이격도 3자리로 반올림(`roundDisparityChart`): 원자재 4개 약 770~786KB, gzip 124~134KB
      - 에뮬레이터(Pixel_API_36, dev 빌드 Hermes) 실측(2026-10-29): JSON.parse 3~19ms + zod 45~135ms(첫 호출이 가장 김), 원자재 4개 모두 차트 표시. 200ms 아래라 행 객체 유지, 열 배열 전환 안 함. 실기기는 이보다 느릴 수 있어 실기기 확인 때 체감만 본다
    - [x] `INTRADAY` 구현 때 잠정 봉의 롤 중 판정(롤 첫날 장중) 다시 보기 (2026-10-30, 규칙의 영업일 순번으로 판정(`isRollPeriodDay`). 보유 월물 수로 정하던 때는 롤 첫날을 놓치고 미국형 CL(3 leg)이 늘 롤 중이었다. dev DB 10/30 잠정 봉 12개 모두 `inRoll false`, D-086)
  - [x] 차트 부품(`src/charts/` `CandleChart`, 스파이크 이관, 한글 Paragraph·선 경로 변환·특수 라벨) (2026-10-27, D-087)
    - [x] C-a 연결 뒤 에뮬레이터·실기기에서 한글 라벨·선 굵기·제스처 FPS 확인 (2026-10-31)
      - 실기기 확인(2026-10-30, iPhone 14 Pro): 핀치 초점 고정·가장 가까운 기간 칩 테두리·십자선이 떠 있으면 바로 끌어 기준일 이동·정보 줄을 차트 안으로(데이터는 비켜 그림)·되돌리기 버튼이 롤 마커를 가리던 것 수정
      - 실기기 측정(2026-10-31, iPhone 14 Pro 운영 번들 `perf:collect`, CL): 진입 372ms(응답 184ms). 이동 UI 87~107fps(봉 756개)·66~109fps(1,512~3,024개), 핀치 116fps, 가장 긴 프레임 28ms·긴 프레임 0. 과거 3년 이어 받기 3회 모두 범위 유지(260~530ms), 튐 없음. C-c 진입 293ms. → 통과
      - [x] 과거 데이터를 받는 동안 햅틱·차트 터치 막기 (2026-10-31, D-108)
        - [x] 실기기에서 로딩 햅틱·받는 동안 끌기 멈춤 확인 (2026-10-31, iPhone 14 Pro 적당)
      - [x] 주요 사용자 액션 햅틱(원자재·ETP 선택, 탭·기간·설정 값 변경, 설정 진입, 회전, 뒤로 가기) (2026-10-31, D-109)
        - [x] 실기기에서 촉감·빈도 확인 (2026-10-31, iPhone 14 Pro 적당)
      - 에뮬레이터 확인(2026-10-29, CL 12M, ko): 한글 꼬리표·월 축·하단 줄·밴드 선 굵기 정상, 끌어서 이동 동작. 이동 뒤 고가 꼬리표가 현재가 점선과 겹치던 것은 꼬리표를 점선 바깥으로 옮겨 고침. FPS는 에뮬레이터가 소프트웨어 GPU(SwiftShader)라 중앙값 113ms/프레임으로 의미 없어 실기기에서 본다
  - [x] C-a 화면(좌상단·좌하단 줄, 기준값 안내, 꼬리표, 롤 표시, 십자선 상세, 기간 칩, 스파이크 삭제) (2026-10-27)
    - [x] y축 라벨이 차트 위·아래 끝에 붙으면 반 높이만큼 안쪽에 그림(맨 위 rare-level 라벨 `110.70`이 title-bar 경계선 아래로 잘리던 것, C-c 끝값 라벨도 같은 배치) (2026-11-03)
      - [ ] 다음 iOS 빌드 때 기기에서 C-a를 과거로 이동해 맨 위 라벨 확인(지금 dev 빌드는 `apiUrl`이 빌드에 박혀 `localhost`라 실기기에서 dev 서버에 못 붙음 → `.env.local`에 `DEV_API_URL`(Mac LAN IP) 넣고 재빌드)
    - [x] 전환 마커 라벨을 월 번호로(겹치면 생략·오른쪽 끝은 ▲ 왼쪽), 전체 월물명은 십자선 상세 (2026-10-28, D-087)
- [x] C-b 월물커브: `GET /v1/commodities/:code/curve`(조회 시 calc, D-046) + 화면(기준일 −/+/0, 날짜 시트·휴장일 직전 거래일, D-021)
  - [x] `GET /v1/commodities/:code/curve?baseDate` + shared 스키마(서버가 기준일을 거래일로 맞춤·이전·다음 기준일·범위, 월물별 변화율, M1→M2 요약) (2026-10-28, D-090)
  - [x] C-b 화면(선차트·변화율·툴팁, −/+/0, 수치 요약) (2026-10-28, `src/charts/CurveChart` Skia 직접 그리기)
    - [x] 에뮬레이터에서 선·점·변화율 라벨 겹침(24개 월물)·툴팁 위치 확인 (2026-10-28, 현재 커브·변화율은 장중 배치 뒤 다시 보기)
    - [x] 실기기 피드백 반영(2026-10-30): 범례·수치 줄을 차트 안으로, 첫·끝 칸 월·변화율 라벨이 그림 영역 밖으로 잘리던 것(`+0.7%`→`0.7%`, `DEC26`→`EC26`)을 안쪽으로 밀어 고침. 기기 재확인 남음
  - [x] 기준일 선택 시트(년·월·일 휠, 휴장일 안내) (2026-10-28, OS 날짜 피커, D-091)
  - [x] 비교 커브를 D 대신 기준일 다음 거래일로(응답 `compareDate`, 범례·툴팁 `비교일`) (2026-11-04, D-114). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): 기준일 11/03·비교일 11/04 범례·상세 박스 정상. −2번 → 10/30(금)·11/02(월)로 주말 건너뜀, + → 11/02·11/03, [↻] → 11/03·11/04로 돌아오고 버튼 사라짐
  - [x] 기준일 표시·범례를 날짜만으로(`D-n`·`기준일`·`현재` 문구 삭제), `0` 버튼을 과거 기준일일 때만 뜨는 차트 되돌리기 버튼으로 (2026-11-04, D-115). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): 기준일 버튼 날짜만·기본 상태에서 [↻] 없음 정상
  - [x] 상세 박스 항목도 `기준일`·`현재` 대신 날짜로 (2026-11-04, D-116). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): 상세 박스 11/03·11/04 항목 정상
  - [x] C-a·C-b 아래 정보 줄을 위쪽으로, 세 차트 탭 x축·아래 조작 줄 높이·[↻] 위치 통일 (2026-11-04, D-117). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): 세 탭 정보 줄 위쪽·x축·아래 조작 줄·탭 바 위치 같음
  - [x] C-b 기준일 실선·비교일 점선, 변화율 라벨 방향 쪽, 상태·스프레드 줄 삭제 / C-c 만기순 선 색·범례·상세 박스 롤 수익률(응답 `lastTradeDate`·`isFront`) (2026-11-04, D-118). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): C-b 실선·점선·방향 쪽 라벨, C-c 만기순 색·범례·상세 박스 `롤 수익률 +37.41%/년` 정상
  - [x] C-b 롤 수익률은 비교일 값만, 범례 오른쪽 같은 줄에 (2026-11-04, D-119). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): 범례 오른쪽 `롤 수익률 +16.2%/년` 한 줄 정상
  - [x] x축 눈금을 겹치지 않는 한 촘촘하게(C-a·C-c), C-b x축 라벨을 월(1월은 연도)로 (2026-11-04, D-121). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): C-a·C-c 월 눈금 매달, C-b `2027 3월 5월…` 정상
  - [x] C-b 변화율 라벨 겹침: 방향 쪽 바깥으로 밀기(D-122), 선과 겹치면 좌우로 밀기(D-123) (2026-11-04). 미러링 확인(2026-11-04, prod OTA `9e7ec32`, CL): 12개 라벨 겹침 없음
  - D-114~D-124 앱 변경은 prod OTA(`9e7ec32`, iOS·Android)로 발행 (2026-11-04)
- [x] 가로 모드 safe area: C-a·C-b·C-c 가로에서 차트 영역이 좌우 inset을 반영하지 않아 Dynamic Island 쪽 가장자리의 봉·선과 왼쪽 위 상세 박스 글자(C-c `APR27`·`롤 수익률` 이름)가 가려짐. title-bar(`CommodityTitleBar`)만 inset을 씀 (2026-11-04 미러링 확인, prod OTA `9e7ec32`, CL)
  - 가로일 때 C 탭 scene에 좌우 inset padding (2026-11-04, D-125). 미러링 확인(2026-11-04, prod OTA `dde6c8a`): 세 탭 왼쪽 봉·선, C-c 왼쪽 위 상세 박스 전부 보임, title-bar도 같은 폭 안쪽, 세로 화면은 변화 없음
  - 그 밖의 가로 표시(title-bar·정보 줄·범례·x·y축·C-b 변화율 라벨·세 탭 십자선 상세)는 정상
- [x] 화면 정리 (2026-11-04, prod OTA `7e7461b`, iOS·Android)
  - B 설정: 맨 아래에 실행 중인 앱 번들(OTA 업데이트·내장) 줄을 기준 시각 줄처럼 화면 아래 고정, 항목을 일반·이격도차트·기타로 묶고 가운데 띠 머리글
  - C title-bar를 공용 왼쪽 정렬 `ScreenHeader`로, 제목은 `원자재명 (심볼)` 한 줄 + 알림 대상이면 🔔. A 목록 🔔는 원자재명·심볼 아래로(공용 `AlertBell`)
  - 차트 Paragraph 숫자를 y축 숫자와 같은 글꼴로(`CHART_FONT_FAMILY`, D-087 보충)
  - 서버 공용 상수·조회 함수, 앱 기간 상태 hook·y축 라벨 여백·테마 토큰 공용화(리팩터, 동작 변화 없음)
  - [x] 기기에서 설정 묶음·번들 줄, A·C 🔔 위치 확인 (2026-11-04, 미러링 iPhone, OTA 업데이트 `01a1a5…`·런타임 `c2bef25`)
    - [x] 개발 빌드 재빌드 뒤 Android spinner 다이얼로그 다크 테마·범위 제한 확인 (2026-10-28, 라이트 기기에서 밝게 떠서 스타일 덮어쓰기·버튼 색 지정, D-091)
- [x] C-c 월물차트: `GET /v1/commodities/:code/contracts` + 화면(C-a 차트 공용 부품 재사용)
  - [x] `GET /v1/commodities/:code/contracts` + shared 스키마(공유 날짜 + 월물별 가격 열 배열, 오늘 잠정 값) (2026-10-28, D-092)
  - [x] C-c 화면(선 5개·끝값 y축 라벨·기간 칩 C-a와 따로 기억·제스처) (2026-10-28, `src/charts/LinesChart` + 공용 `useChartViewport`, D-093)
    - [x] 에뮬레이터에서 선 색 구분·끝값 라벨 밀어 쌓기·이동·기간 칩·십자선 상세 확인 (2026-10-28, 숫자 글꼴 서브픽셀 위치로 `J AN27` 간격 수정)
    - [x] 끝값 라벨을 보이는 범위 마지막 날 값으로(이동해도 범례 유지), 기간 맞춤이 처음 진입 때 빠지던 경쟁 상태 수정 (2026-10-28, D-093)
    - [ ] 실기기에서 같은 항목·핀치 확대 확인
      - 미러링 확인(2026-11-03, prod CL): 선 5개 색·끝값 라벨 쌓기·끌어 이동 뒤 끝값이 보이는 범위 마지막 값·길게 눌러 십자선 상세·C-a와 따로 기간 기억·목록 재진입 때 6M(D-107) 정상. 핀치는 기기 손으로

### 5-7. 장중 배치
- [x] Yahoo 실측: 다중 심볼 quote·당일 고가·저가 누적 시작 시각(17:00 CT 여부)·지연 시각 → 호출 전략 결정
  - [x] 실측: quote는 crumb 필요(401), spark는 20개·종가만, chart는 월물별·제한 없음, 고가·저가·거래량은 17:00 CT 세션 누적, 약 10분 지연 (2026-10-28, `docs/research/market-data.md`)
  - [x] 호출 전략 결정: 지수 월물은 chart, 나머지 커브 월물은 spark (2026-10-28, D-094)
- [x] `INTRADAY` 작업: `intraday_snapshot`·`index_snapshot`(이평선 4종 이격도), 정산 대기·휴장 중지, 응답 형식 검증 실패 = 배치 실패
  - [x] Yahoo 장중 소스(`sources/yahooIntraday.ts`): chart 세션 값·spark 현재가, 404 월물은 빠짐, 응답 zod 검증 (2026-10-28, D-094)
  - [x] 작업 본체(`jobs/intraday.ts`): OPEN일 때만, 커브 월물 24개 + 보유 월물 → `intraday_snapshot`, 기준값별 잠정 지수·이평선 4종 이격도 → `index_snapshot` (2026-10-28, D-094). 실데이터 확인은 저장 없이만 했다(dev DB가 10/26까지라 정산 대기)
  - [x] 첫 `DAILY_SETTLE` 뒤 dev에서 저장까지 1회 실행, `INTRADAY_EXPECTED_MS` 실측: 10/28 20:58 CT(10/29 세션 야간) 1회 7.4초, `intraday_snapshot` 52행·`index_snapshot` 12행, CL 알림 UP 5% 1건 FCM 접수(나머지 레벨 SUPPRESSED). 기기(에뮬레이터)는 꺼져 있었고, 뒤에 보낸 테스트 푸시가 FCM 보관 메시지를 덮어써 이 알림은 받지 못함(notification 메시지는 기본 덮어쓰기, 기기가 꺼진 동안 쌓인 알림은 마지막 1건만 남음). 테스트 푸시는 백그라운드에서 수신 확인. 야간이라 Yahoo spark 현재가 없는 먼 월물이 많음(GC 6·SI 5·CL 17·NG 24개 수집) (2026-10-28)
- [x] A·C freshness 장중 값·오늘 잠정 봉 반영 확인 (2026-10-30, 10/29 19:20 CT dev `INTRADAY` 1회 5.2초 뒤 API로 확인: A·C-a·C-b·C-c 모두 `tradeDate 2026-10-30`·`OPEN`·`asOf` 19:15 CT 슬롯·`delayed`·`nextUpdateAt` 19:35 CT, A 가격·C-a 잠정 봉 종가·C-b 현재 커브·C-c 마지막 값이 같은 장중 값(CLZ26 102.69), C-a·C-c `provisional: true`. 에뮬레이터 화면은 꺼져 있어 보지 않음)

### 5-8. 알림
- [x] 첫 푸시 준비: Firebase 프로젝트(두 package 등록)·`google-services.json`·서비스 계정 키 (D-037) (2026-10-28, 키는 저장소 밖, dry run으로 인증 확인)
- [x] 기기 등록: 앱 `push/`(토큰·플랫폼·시간대) + `PUT /v1/devices`, 무효 토큰 자동 삭제
  - [x] 서버 `PUT /v1/devices`(shared `devices.ts`, `pushToken` 기준 upsert) (2026-10-28)
  - [x] 앱 `push/`: `expo-notifications` 네이티브 토큰·권한 요청·실행 때(접근 키 저장 직후 포함) `PUT /v1/devices`, 토큰 바뀌면 다시 등록 (2026-10-28)
  - [x] 에뮬레이터로 실제 푸시 수신 확인 (2026-10-28, 기기 등록·채널 2개·FCM 발송 → alerts 채널 수신)
  - [x] 무효 토큰 삭제: 발송 결과 `INVALID_TOKEN`(FCM `UNREGISTERED`·APNs 410)이면 행 삭제(`push/broadcast.ts`) (2026-10-28)
- [x] 발송: `push/` FCM 발송 인터페이스(APNs는 Apple 가입 뒤), shared 푸시 문구(ko/en), Android 채널(시세·`ops`)
  - [x] shared `push.ts`: rare 레벨·운영 알림 문구(ko/en), Android 채널 id(`alerts`·`ops`) (2026-10-28)
  - [x] 서버 `push/` 발송 인터페이스(`PushSender`)·전체 기기 발송(`broadcast`, 한 기기라도 성공하면 전달)·가짜 발송기 (2026-10-28)
  - [x] FCM HTTP v1 발송기: `push/fcmSender.ts`(`firebase-admin`, `alerts`·`ops` 채널 지정, 본문 없으면 제목만, `UNREGISTERED`면 `INVALID_TOKEN`, iOS는 APNs 전까지 `FAILED`). 실제 발송 확인은 서비스 계정 키 뒤 (2026-10-28)
  - [x] 운영 알림: 스케줄러가 재시도까지 실패하면 `jobFailedPush`를 `ops` 채널로 발송, 같은 작업·거래일은 다시 성공할 때까지 1회(`jobs/opsAlert.ts`, `ops_notified_at`) (2026-10-28)
  - [x] `main.ts`에 운영 알림 연결(`push/configuredSender.ts`, 키 없으면 모두 `FAILED`) (2026-10-28)
  - [x] 앱 Android 채널 만들기(`alerts` 높음·`ops` 기본, 이름은 표시 언어) (2026-10-28)
- [x] `INTRADAY`에 판정·발송 연결(`alert_record` 중복 방지·보류) + `DEFERRED_PUSH` 작업(30분)
  - [x] 판정·기록·즉시 발송: `jobs/rareAlert.ts`(알림 원자재만, 판정 중지·기준값 대체, 보낼 행은 `RETRY`로 먼저 넣고 발송 결과로 `SENT`/`RETRY`, 거부 시간 `HELD`) + `INTRADAY` 연결 + `db/rareAlertStore.ts` (2026-10-28)
  - [x] `RETRY` 재발송(`planRetries`): 공통 `createAlertRetry`(지난 슬롯의 `RETRY`만, 덮였으면 `SUPPRESSED`, 거부 시간이면 대기, 다시 실패면 `FAILED`) + `INTRADAY`·`DEFERRED_PUSH` 앞단 연결 (2026-10-28)
  - [x] `DEFERRED_PUSH` 작업: `jobs/deferredPush.ts`(재발송 → `createDeferredAlert`), `planDeferred`로 원자재·방향별 가장 드문 `HELD` 1건을 지연 발송 문구로 보내고 나머지 `SUPPRESSED`, 실패면 `RETRY` (2026-10-28)
  - [x] `handlers.ts`에 판정·재발송 연결과 `DEFERRED_PUSH` 등록 (2026-10-28)
  - [x] 재발송은 지연 발송 문구, 감지 후 24시간 지난 `RETRY`는 `FAILED` (2026-10-28, D-097)
- [x] 알림 탭 이동: rare 레벨 알림은 해당 원자재 C-a(스택 A → C), 운영·모르는 알림은 A. 꺼진 앱은 마지막 응답을 읽고 지운다(`push/NotificationTapHandler.tsx`) (2026-10-28)
- [x] 앱을 보고 있을 때 온 알림도 배너·목록·소리로 표시(`push/foregroundNotifications.ts`, 배지 안 씀). 에뮬레이터 A 화면에서 테스트 푸시 배너 확인 (2026-10-29)
- [x] B-a 알림 설정 화면(대상·현재 레벨 요약·거부 시간·권한 상태·안내 문구)
  - [x] 권한 상태(꺼지면 경고 + [허용]/영구 거부면 [설정 열기], 앱 복귀 때 다시 확인)·안내 문구(`push/usePushPermission.ts`) (2026-10-28)
  - [x] 대상 원자재·현재 적용 기준 요약 (2026-10-28)
  - [x] 알림 거부 시간: 켜기(기본 23:00~07:00)·끄기(null), 30분 단위 48칸 시트, 반대쪽 시각은 막음, 자정 넘김은 (다음 날) 표시(`QuietTimeSection.tsx`) (2026-10-28)
- [x] 알림 대상이 없으면 A·C [⚙]에 빨간 점, 알림 대상을 바꾸면 A 목록을 다시 조회해 🔔 갱신 (2026-11-04, D-124). 미러링 확인(2026-11-04, prod OTA `9e7ec32`): 알림 대상 없음 → C·A [⚙] 빨간 점·A 🔔 사라짐, 천연가스로 되돌리면 점 사라지고 🔔 바로 돌아옴

- [ ] 기기별 설정(D-120): 설정·알림 판정·기록을 installation ID(`X-Device-Id`) 기준 기기별로
  - [x] 결정·문서(decisions·product·data-model·architecture·screens) (2026-11-04)
  - [x] 앱: installation ID 생성·SecureStore(`api/deviceId.ts`, Math.random UUID v4), 인증 요청에 `X-Device-Id` (2026-11-04)
  - [x] 서버: `app_settings` → `device` 설정 컬럼 마이그레이션(`0006_device_settings`, 기존 기기 행 삭제), 토큰 없어도 `PUT /v1/devices`(shared `pushToken` nullable, 앱은 빈 토큰이면 null로 등록), `/v1/settings`·`/v1/commodities`·`/v1/devices`가 헤더 기기 사용(`api/deviceId.ts`, 처음 보인 기기는 기본값 행), 같은 토큰은 다른 기기 행에서 비움, 무효 토큰은 비우기. dev DB 적용·저장소 동작 확인 (2026-11-04)
  - [x] 알림: `alert_record.device_id`(중복 방지 키, 기기 삭제 시 함께 삭제, `0007_alert_record_device`에서 기존 기록 삭제), 알림 원자재가 같은 기기마다 판정·기록·그 기기로만 발송, 재시도·지연 발송은 기록의 기기 설정(거부 시간)·언어, 운영·ETP 후보·다수 판정 알림은 기기별 언어 문구. dev DB 적용·저장소 동작 확인 (2026-11-04)
  - [x] 서버 배포(`5f5eef7`, `0006`·`0007` 적용으로 prod 기기·설정·알림 기록 초기화) + 앱 OTA(iOS·Android). iPhone 14 Pro·16 Pro Max에 prod Release(Personal Team) 새로 설치 → prod `device`에 두 행, 기준·알림 원자재가 기기마다 따로 저장됨 확인 (2026-11-04)
  - [ ] 기기별 알림 수신 확인(푸시 토큰 등록 기기 필요: Android 실기기 또는 Apple 가입 뒤 iOS)

### 5-9. ETP
- [x] ETP 스키마(`etp_product`·`etp_series`) + KRX Open API 가입·ETN 만기일·기초지수 필드 확인
  - [x] KRX Open API 가입·필드 확인, ETN 만기일 소스 조사 → 만기일·상장일은 손 입력 선택 필드 (2026-10-28, D-096)
  - [x] `etp_product`·`etp_series` 테이블(`0004_etp`), shared `ETP_MARKETS`·`ETP_TYPES`·`FX_HEDGES`. 미국 새 후보는 매핑 전이라 원자재·종류·배수·규칙 nullable (2026-10-28)
- [x] 국내 수집기(네이버·`siseJson`·KRX): 종목명 파싱(배수·환헤지·시리즈), 시리즈 묶기, 상장폐지 처리
  - [x] 종목명 파싱 순수 함수(`sources/krxEtpName.ts`): 원자재는 "선물" 앞 단어, 배수 nX·레버리지·인버스, 환헤지 (H)·(합성 H), 시리즈 끝 글자. KRX 전체 목록에서 리서치 상품 수와 일치 (2026-10-28)
  - [x] 시리즈 묶기·상장폐지 순수 함수(`calc/etpSeries.ts`): ETN은 (발행사, 원자재, 배수, 환헤지) 키로 기존·새 상품에 묶고 ETF는 종목마다 상품 하나. 목록에서 빠지면 폐지, 모든 시리즈 폐지 시 비활성, 다시 나오면 되돌림. KRX 전체 목록 80종목 → 79상품(삼성 2X WTI 한 쌍만 묶임) (2026-10-28)
  - [x] 수집·저장: `ETP` 작업이 KRX `etf_bydd_trd`·`etn_bydd_trd` 전일분(휴장일이면 최대 10일 거슬러) → 파싱 → 묶기 계획 → 한 트랜잭션 반영. ETF·ETN 한쪽만 비거나 원자재 종목이 상장 중 시리즈의 절반 미만이면 실패(대량 폐지 방지). dev 실행 79상품·80시리즈, 재실행 무변경 (2026-10-28)
- [x] 미국 수집기(Nasdaq·Yahoo) + 매핑표(D-016), 새 후보 1회 알림(D-025), 최소 순자산(D-015)
  - [x] 소스·매핑표: Nasdaq 스크리너(후보)·summary(순자산·총보수), Yahoo chart(상장일·일별 거래대금), 매핑표 17개·제외 44개·새 후보 판별(`sources/usEtpMap.ts`). 실데이터 매핑 17·새 후보 0 (2026-10-28, D-099)
  - [x] `ETP` 작업에 미국 동기화(`jobs/etpUs.ts`): 매핑 상품 저장·속성 갱신(받은 값만), 목록에서 빠지면 폐지·비활성, 새 후보는 `needs_review` 행(후보에서 빠지면 삭제). 매핑 상품이 절반 미만이거나 두 소스가 모두 실패하면 미반영. 국내·미국은 한쪽이 실패해도 다른 쪽을 반영. dev 실행 17상품 저장·재실행 무변경, 작업 전체 약 71초 (2026-10-28)
  - [x] 새 후보 1회 알림(`jobs/etpCandidateAlert.ts`): `ETP` 작업 끝에 알리지 않은 후보를 한 건으로 묶어 ops 채널로 보내고 `review_notified_at` 기록(한 기기에도 못 보내면 다음 작업에 다시). 미국 동기화가 실패해도 보냄, 누르면 A. dev DB 1회 발송·재실행 미발송 확인 (2026-10-28)
- [x] `ETP` 작업: 순자산·평균 거래대금(D-017), 다수 판정 재계산·변경 알림(D-024)
  - [x] 다수 판정 순수 함수(`calc/majorityRule.ts`): 원자재·시장별 상품 수, 동률이면 순자산 합계, 하한(미국 $10M·국내 10억 원) 미만·순자산 모름·규칙 모름은 제외(D-015). 국내 규칙은 기초지수 이름(S&P GSCI·DJCI·Bloomberg Single·Solactive → `GSCI`, Enhanced → `GSCI_ENHANCED`). dev 실데이터 8개 판정 모두 현재 규칙과 같음 (2026-10-28)
  - [x] 판정 저장(`roll_rule.majority_rule_id`·`majority_checked_at`)·변경 알림(D-024, `jobs/majorityAlert.ts`. dev ETP 작업 1회 실행에서 8행 모두 현재 규칙과 같아 기록만 함, 2026-10-28)
  - [x] 국내 순자산(ETF 순자산총액·ETN 시가총액)·평균 거래대금(KRX `ACC_TRDVAL` 20거래일, 시리즈 합산). dev 실행 79상품 모두 채움, 약 11초 (2026-10-28, D-017 수정)
- [x] `GET /v1/commodities/:code/etps`·`GET /v1/etps/:id` + C-d(필터 4종·정렬 3종)·C-d-a 화면
  - [x] 조회 API 2개(shared `etps.ts`): 목록은 매핑 끝남·상장 중 상품과 상장 중 종목코드·순자산·평균 거래대금, 상세는 상장 중 시리즈 줄과 첫 시리즈 상장일. dev 응답 79상품 (2026-10-28)
  - [x] C-d 화면: 필터 4종(시장·유형·배수·환헤지, 배수는 받은 상품에 있는 값만)·정렬 3종(순자산·거래대금은 시장 안 큰 순서, 값은 `1,555억 원`·`$12.3M`로 행 끝에 붙임), 선택 기억 안 함. 에뮬레이터 실데이터 확인 (2026-10-28)
  - [x] C-d-a 화면: 제목은 상품명, 속성 9줄(빈 값 `—`)·시리즈 줄(`B 시리즈 · 530031 · 만기 …`)·운용사 페이지 버튼(http(s) 주소만)·자동 수집 안내. 에뮬레이터 실데이터 확인. 국내 상품은 총보수·상장일·운용사 주소를 아직 수집하지 않아 `—` (2026-10-28)
  - [x] 국내 운용사 주소(브랜드 고정표 `sources/krxIssuerUrls.ts`)·ETF 총보수(네이버 `integration`, 실패 시 저장값 유지)를 `ETP` 작업에서 채움. dev 79상품 주소·ETF 9종 총보수. ETN 총보수·상장일은 소스 없음(상장일은 손 입력, D-096) (2026-10-28, D-098)

### 5-10. 운영과 첫 배포
- [x] `CALENDAR` 작업(60일 공백 점검), `BACKUP` 작업(`pg_dump`·7개 보관·보관 기간 행 정리, D-045, D-046), Healthchecks.io ping (운영 알림은 5-8에서 완료)
  - [x] `CALENDAR` 작업(`jobs/calendar.ts`): 앞으로 60일이 걸친 연도의 `trading_day` 행 유무 점검(휴장일은 행이 없어 연도 단위), 빠지면 실패 → 운영 알림. dev 2026·2027 입력 상태에서 성공, 2028이 필요한 기준 시각에서 실패 확인 (2026-10-28)
  - [x] `BACKUP` 작업(`jobs/backup.ts`): `pg_dump -Fc`를 `.partial`로 쓴 뒤 이름 변경 → 덤프 이름 형식 파일만 최근 7개 보관 → 스냅숏 90일·`alert_record`·`batch_run` 365일 지난 행 삭제(한 트랜잭션). 덤프 실패면 지우지 않음. `BACKUP_DIR` 없으면 실패. dev에서 덤프(약 19MB, `pg_restore --list` 확인)·7개 보관·실패 메시지(접속 문자열 미포함) 확인 (2026-10-28)
  - [x] Healthchecks.io ping(`jobs/healthcheck.ts`): 스케줄러가 작업마다 재시도까지 묶어 `/start` → 성공 또는 `/fail`, `rid`로 짝지음, slug는 작업 이름 소문자, 키 없으면(dev) 보내지 않음, ping 실패는 로그만 (2026-10-28)
- [x] 첫 서버 배포 전: Oracle VM 생성·PAYG 전환(D-034), 도메인(무료 DDNS / 저가 도메인, D-036), Caddy·방화벽(VM 보안 목록과 OS 방화벽의 80·443), Healthchecks.io check(D-045: 작업 7개 + Mac 내려받기 `backup_pull` 7일·여유 2일)
  - [x] Oracle VM 생성·PAYG 전환: 도쿄 A1 2 OCPU·12GB, Ubuntu 26.04, OCI Budget 월 $1 (2026-10-31, D-034)
  - [x] VM 준비: Docker 29.9·Compose v5.6, `ubuntu` docker 그룹, OS 방화벽(`rules.v4`) TCP 80·443·UDP 443, Security List TCP 80·443. 재부팅 뒤 유지·임시 컨테이너 80번으로 Mac에서 HTTP 200 확인 (2026-10-31)
  - [x] 도메인 `futureetp-api.duckdns.org`(DuckDNS, deSEC dedyn.io는 신규 등록 중단): VM cron이 30분마다 A 레코드 갱신, 임시 Caddy로 Let's Encrypt staging 인증서 발급·HTTPS 200·HTTP→HTTPS 308 확인 (2026-10-31, D-036)
  - [x] Mac `~/.config/futureetp/ops.env`(권한 600): `DEPLOY_HOST=ubuntu@<VM 공인 IP>` (2026-10-31), `HEALTHCHECKS_PING_KEY`(backup_pull용)는 Healthchecks.io 항목 때 추가
  - [x] VM `~/futureetp/infra/.env`(권한 600): `DOMAIN=futureetp-api.duckdns.org`, `POSTGRES_PASSWORD`(`openssl rand -hex 32`), `API_TOKEN`(새 prod 키, Mac `~/.config/futureetp/prod-api-token`에 보관, QR은 `npm run access-key -- --show < 그 파일`), 외부 키 3개(dev `.env`와 같은 값). 값은 출력하지 않고 ssh stdin으로 넘김. `HEALTHCHECKS_PING_KEY`는 Healthchecks.io 항목 때 추가 (2026-10-31)
  - [x] FCM 키: Mac `~/.config/futureetp/fcm-service-account.json` → VM `infra/secrets/fcm-service-account.json`(권한 600, 해시 일치, 소유자 uid 1000은 배포 스크립트가 맞춤) (2026-10-31)
  - [x] Healthchecks.io: 프로젝트·ping key, Management API로 check 8개 생성(작업 7개는 `scheduler.ts` 일정·시간대와 같게, 여유는 재시도 포함 실행 시간 기준 `daily_settle` 60분·`settle_revision` 90분·`deferred_push`·`intraday` 10분·나머지 30분, Mac `backup_pull` 7일·여유 2일). ping key는 VM `infra/.env`·Mac `ops.env`에, 생성 스크립트는 Mac `~/.config/futureetp/healthchecks-setup.sh`(API 키 `healthchecks.api-key`) (2026-10-31)
  - [x] (선택) Security List에 UDP 443(HTTP/3) 추가, OCI Budget 알림 규칙 확인 (2026-11-02)
    - UDP 443: Default Security List에 추가, Mac Homebrew curl `--http3-only`로 `/v1/health` 200(`http_version=3`). Budget 알림은 이전에 설정해 둠(사용자 확인)
  - [x] Mac `~/.config/futureetp/duckdns.token` 삭제: VM `~/.config/duckdns/token`과 같은 값 확인 뒤 지움, 다시 필요하면 DuckDNS 웹에서 확인 (2026-10-31)
- [x] `infra/`(Dockerfile·compose·Caddyfile, Caddy `encode`로 응답 압축: C-a 응답이 압축 전 약 1MB) + 배포 스크립트(rsync → 빌드 → 덤프 → 마이그레이션 → 교체, D-048), 백업 내려받기·dev 복원 스크립트
  - [x] `apps/server/Dockerfile`·`.dockerignore`·`infra/docker-compose.yml`·`Caddyfile`·`.env.example`, 로그 크기 제한. 이미지와 같은 파일 구성으로 `npm ci --omit=dev` 후 서버 기동·health 확인(Mac에 Docker가 없어 이미지 빌드·compose 기동은 미확인) (2026-10-28)
  - [x] 로컬 Docker(Colima)로 `deploy-remote.sh` 실제 실행: 이미지 빌드(452MB, `.env`·테스트·앱 소스 없음) → 배포 전 덤프 → 일회성 컨테이너 마이그레이션(테이블 19·마이그레이션 5) → 교체·health, Caddy 경유 HTTPS health·HTTP→HTTPS 308·키 없음 401, 컨테이너에서 `BACKUP`(pg_dump 18.6, `/backups` 쓰기)·`calendar:import`·`CALENDAR` 성공, 잘못된 FCM 키면 서버가 뜨지 않아 `--wait`가 배포 실패로 끝남. 이미지에 빠져 있던 `scripts/calendar` 추가. 시험은 스케줄러 끄고 포트 8080·8443, sudo·uid 변경은 가짜(실제 VM은 첫 배포 때) (2026-10-28)
  - [x] prod 초기 데이터(D-100): `npm run prod:seed`가 dev DB를 빈 prod DB에 넣음(`device`·`alert_record`·`batch_run` 행 제외). Colima 시험 VM에서 배포 → 시드(37초, 뺀 3개 외 모든 테이블 행 수가 dev와 같음, 마이그레이션 5) → Caddy 경유 시세 조회·`CALENDAR` 성공, 재실행·비대화 입력·마이그레이션 수 불일치는 거부 확인. 실제 VM은 첫 배포 때 (2026-10-28)
  - [x] 배포 스크립트(`scripts/deploy.sh` + `infra/deploy-remote.sh`): 가짜 `docker`로 단계 순서·마이그레이션 실패 시 교체 안 함·배포 전 덤프 3개 보관, 가짜 `ssh`로 rsync가 VM 전용 파일은 남기고 저장소에서 지운 파일은 지우는 것 확인(실제 VM은 첫 배포 때) (2026-10-28)
  - [x] 백업 내려받기·dev 복원 스크립트(`scripts/backup-pull.sh`·`dev-restore.sh`, 설정은 `~/.config/futureetp/ops.env`): 가짜 `ssh`·`rsync`·`curl`로 최신 덤프만 받기·이미 받았으면 건너뛰기·손상 덤프 거부·8개 보관·성공/`/fail` 신호 확인. 복원은 scratch DB에 실제로 dev 덤프 복원(테이블 19·마이그레이션 5·행 수 일치), 기존 스키마 위 재복원, `device`·`HELD`·`RETRY`만 삭제, 손상 덤프는 롤백돼 기존 DB 유지, 원격 주소·비대화 `--yes` 없음 거부 확인(실제 VM 내려받기는 첫 배포 뒤) (2026-10-28)
  - [x] 실제 VM 첫 배포: `npm run deploy` → 바로 `npm run prod:seed -- --yes`(빈 DB로 도는 시간을 줄임, 16:05 CT `DAILY_SETTLE` 전) → 검증(운영 인증서·키 없음 401·조회·응답 압축·스케줄러 로그·Healthchecks, 다음 날 `BACKUP` 뒤 `npm run backup:pull`)
    - 준비(2026-11-02): dev DB를 10/30까지 정산(CL 19·GC 14·NG 26·SI 13개, 이격도 10/30). 앞 두 번은 Mac 잠자기로 CL·NG 요청이 타임아웃돼 실패했고, `caffeinate -i`로 다시 돌리니 받은 원자재는 건너뛰고 성공(5분 56초). `npm run check` 통과. VM `infra/.env` 8개 항목·FCM 키·`sudo -n`·디스크 45GB 여유 확인. VM `ubuntu`가 uid 1001이라 첫 배포 때 스크립트가 FCM 키·`backups` 소유자를 uid 1000으로 바꾼다. Mac `~/.ssh/config`에 VM 키(`~/.ssh/futureetp_oci`, 암호는 키체인) 등록
    - [x] 배포·시드(2026-11-02 04:18 CT, `dd3538d`): 첫 빌드는 `deploy.sh`의 `git archive`에 `scripts/calendar`가 빠져 실패(Colima 시험은 저장소 전체가 빌드 문맥이라 못 봄) → 추가 후 성공, 마이그레이션 적용·컨테이너 3개 healthy. 시드 일봉 1,158,740행(마지막 10/30)·거래일 4,419행. 검증: Let's Encrypt 운영 인증서(YE2, 2027-01-31까지)·HTTP→HTTPS 308·키 없음·틀린 키 401·`/v1/health`·설정·A·C-a·C-b·C-c 조회 200, C-a CL 압축 전 141KB → zstd 25KB(`content-encoding: zstd`)·HTTP/3 `alt-svc`. 04:30 CT `INTRADAY`·`DEFERRED_PUSH` 성공·Healthchecks `up`. CL 알림이 `RETRY`(등록 기기 0개: 시드가 `device`를 빼고 prod를 보는 앱이 아직 없음)
    - [x] 16:05 CT `DAILY_SETTLE`(11/2분)·16:15 `CALENDAR`·16:30 `BACKUP` 성공·Healthchecks, 다음 날 `npm run backup:pull` (2026-11-02)
      - prod `batch_run`: `DAILY_SETTLE` 11/02 1회 성공 23분 21초(Massive 분당 5회 × 월물 104개라 예상 범위, Healthchecks 여유 60분 안), 일봉 CL 18·GC 15·NG 26·SI 11개. 이어서 `SETTLE_REVISION`(10/30)·`CALENDAR`(2027-01-01까지)·`BACKUP`(덤프 19MB, 3.6초)·17:30 `ETP`(미국 17개 매핑·새 후보 0, 129초) 성공, `INTRADAY`·`DEFERRED_PUSH` 102회 모두 성공. Healthchecks 작업 7개 `up`
      - `npm run backup:pull`: `futureetp-20261102T223000Z.dump`를 `~/futureetp-backups`로 받고 `pg_restore --list` 통과, `backup_pull` check `up`
      - CL 알림은 등록 기기가 없어 계속 `FAILED`(0 device). prod 앱 설치·접근 키 등록 뒤 해소
    - 시드는 `batch_run`을 빼므로 prod 첫 `DAILY_SETTLE`은 dev 마지막 일봉 다음 거래일부터 따라잡는다(최대 5거래일). 배포가 늦어지면 dev를 다시 정산한 뒤 시드한다
- [x] 첫 서버 배포 때 `app.config.ts`의 `PROD_API_URL`(`futureetp.invalid`)을 실제 도메인으로 교체: `https://futureetp-api.duckdns.org` (2026-10-31, D-052)
- [ ] release APK 첫 빌드 때: 서명 키(keystore) 생성과 저장소 밖 백업 (D-039), Expo 계정·`eas init`·expo-updates 설치(`updates.url`·`runtimeVersion` fingerprint·채널 헤더) (D-052)
  - [x] 서명 키: `~/.config/futureetp/android-release.jks`(PKCS12, RSA 4096, 별칭 `futureetp`, 인증서 SHA-256 `79:42:11:C6…AE:B1:51`)와 비밀번호 파일 `android-release.properties`(권한 600). `app.config.ts`의 `withReleaseSigning`이 release를 이 키로 서명하고, 파일이 없으면 release 빌드를 멈춘다. `assembleRelease` 성공(R8 포함, 11분 29초). 네이티브 라이브러리는 `withArm64Only`로 `arm64-v8a`만 넣어 APK 180MB → 58MB·`apksigner`로 서명 지문 확인 (2026-11-02)
  - [x] Expo 계정 `jungseyoon`·`eas init`(프로젝트 `@jungseyoon/futureetp`, projectId는 `app.config.ts`)·expo-updates `~58.0.20`: `updates.url`·`runtimeVersion` fingerprint·`expo-channel-name: production` 헤더, dev 변형은 업데이트 끔. EAS `production` 채널·브랜치 생성, `eas.json`은 CLI 버전만. prebuild로 AndroidManifest 값 확인 (2026-11-02)
  - [ ] OTA 첫 확인: release APK 설치 뒤 JS만 바꿔 `npm run update:prod -w apps/mobile` → 앱 재시작 두 번 만에 반영되는지
    - iOS 확인(2026-11-03): Personal Team prod 빌드(iPhone 14 Pro)에 `--platform ios` update(`8f7d280`, runtime `c2bef25c…`) → 재시작 두 번 만에 반영. Android는 기기 확인 보류(iOS 우선)
  - [ ] 서명 키 백업: `.jks`와 `.properties`를 저장소·Mac 밖(비밀번호 관리자·외장 디스크 등)에 보관. 잃으면 같은 앱으로 업데이트할 수 없어 지우고 다시 깔아야 한다(접근 키 다시 입력)
  - [ ] R8 축소 확인: dev 실행 logcat에 `ExpoModulesV2` 경고 — `expo.modules.sqlite.SQLAction`이 `Enumerable`을 구현하지 않아 release 빌드가 실패하거나 enum 이름이 JS로 넘어갈 수 있음. 빌드 성공과 표시 설정 저장·복원 동작 확인, 문제면 expo-sqlite 업데이트 또는 ProGuard keep 규칙 (D-073)
    - 빌드(2026-11-02): R8 포함 `assembleRelease` 성공. mapping에서 `SQLAction` 상수 이름이 바뀐 것(`INSERT`→`X` 등)은 확인했지만, 앱이 쓰는 `expo-sqlite/kv-store` `Storage`는 변경 리스너를 켜지 않아 이 enum이 JS로 넘어가지 않는다. 남은 것: release APK를 기기에 설치해 표시 설정(언어·등락 색) 저장 → 앱 재시작 뒤 복원 확인
- [x] 테스트 앱 배포(Firebase App Distribution): 기존 Firebase 프로젝트(FCM, D-037)의 prod Android 앱에 release APK 업로드, 테스터 그룹 `owner`(본인)에 배포. `npm run build:android:release -w apps/mobile` → `npm run distribute:android -- [노트]`(루트, 노트 기본은 `apps/mobile`·`packages/shared`를 마지막으로 바꾼 커밋, 그 커밋보다 오래된 APK는 거부). 첫 배포 1.0.0 (1) (2026-11-02, D-039 보충)
  - 재배포 2026-11-03: `31c47b4`(C 차트 십자선·등락 색 수정분), 같은 1.0.0 (1)·서명 지문 일치. 빌드 중 작업 트리가 바뀌면 미커밋 코드가 번들에 들어가므로 깨끗한 상태에서 빌드한다
  - 2026-11-03: versionCode를 커밋 수(`git rev-list --count HEAD`)로 자동 지정, 배포 스크립트를 루트 `scripts/distribute-android.sh`로 옮김(fingerprint 변화 없음 확인). `apps/mobile` `distribute:android`는 지우면 fingerprint가 바뀌어 남겨 둠: 다음 네이티브 변경 때 함께 삭제
  - [ ] 기기에서 초대 수락 → App Tester로 설치 → 접근 키 QR 등록·표시 설정 저장/복원·OTA 첫 확인(위 release APK 항목)
- [x] 원격 저장소 생성 및 연결 (GitHub, private): `seyoun10/futureETP`에 `main` push, GitHub Actions `check` workflow(`npm ci` → `npm run check`, Node는 `.nvmrc`) 첫 실행 성공 2m40s (2026-11-02, D-039 보충)
- [ ] Apple Developer 가입(최대한 늦게) 뒤: iOS 실기기 설치 방식 결정, APNs 발송 경로 추가 (D-037, D-039)
  - 2026-11-02: iOS 테스트 배포(Firebase App Distribution·TestFlight)는 ad-hoc 서명·UDID 등록이 유료 계정 전용이라 가입 전에는 불가. prod 변형 Personal Team 직접 설치도 보류하고 Android 기기 확인을 먼저 한다
  - [x] 2026-11-03: prod 변형 Release를 Personal Team으로 iPhone 14 Pro·16 Pro Max에 설치·실행(푸시 권한 빼고, 7일 만료). 다른 세션과 겹치지 않게 별도 git worktree에서 prebuild·빌드. 16 Pro Max는 `-allowProvisioningDeviceRegistration`으로 팀에 등록 (D-039 보충)
    - [x] 두 기기에서 접근 키 QR 등록 (2026-11-03)
    - [ ] 두 기기에서 운영 데이터 표시·카메라 권한 문구 확인

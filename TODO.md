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
- [ ] **[다음 작업]** 결정된 스택 기준으로 CLAUDE.md Key Patterns / Coding Conventions 정리 (API 응답·에러 규약 확정. default export 예외는 D-029로 반영 완료)

## 3. Architecture 결정
- [ ] 디렉터리 구조
- [ ] 레이어 구성 (UI / 상태 / 데이터 접근)
- [ ] API 통신 및 에러 처리 규약
- [ ] 환경 설정 분리 (dev / prod)
- [ ] 1단계에서 미룬 항목: 서버 접근 비밀 값 저장·교체, 운영자 실패 알림, 차트 구간 데이터 로딩, `intraday_snapshot`·`index_snapshot`·`alert_record` 보관 기간, 커브 조회 캐시

## 4. 프로젝트 생성
- [x] git init 및 .gitignore (스캐폴딩 시 생성되는 .gitignore와 병합 필요)
- [ ] 프로젝트 스캐폴딩
- [ ] lint / format / test 설정
- [ ] Android Studio(SDK·에뮬레이터)·JDK 설치 (D-039)
- [ ] Android 에뮬레이터 / iOS 시뮬레이터에서 실행 확인
- [ ] CLAUDE.md 갱신 (Tech Stack, Architecture, Commands)
- [ ] SessionStart hook(~/.claude/hooks/swift-env.sh)에 Node 버전 주입 추가 (package.json 존재 시)

## 5. 개발
- 개발 부분의 세부 항목은 이전 단계가 마무리된 이후 정리
- [ ] 첫 작업: C-a 차트 스파이크(D-032) — log 축, x축만 핀치, 보이는 봉 기준 y 자동 맞춤, 봉 4,000개 성능, 십자선 스냅 햅틱
- [ ] 원격 저장소 생성 및 연결 (GitHub, private) 후 push: 앱을 기기에 설치해 쓸 수 있는 시점에 진행 (2026-10-22 결정). 이때 GitHub Actions로 `npm run check` CI 추가 (D-039)
- [ ] Apple Developer 가입(최대한 늦게) 뒤: iOS 실기기 설치 방식 결정, APNs 발송 경로 추가 (D-037, D-039)
- 적절한 개발 전략 수립 : harness, agent-teams(frontend, backend, db, review, test) 구성

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
- [ ] **[다음 작업]** 외부 연동 요구사항 (인증, 결제, 푸시, 외부 API 등) — Step 2
  - Step 2 리서치 진행 순서: ①시세 소스 → ②CME 달력 → ③롤 규칙 → ④ETP 소스 → ⑤외부 연동 문서화
  - ① 시세 소스 (2026-10-22 완료, `docs/research/market-data.md`): 개인용 앱 전환(D-011), 비용 $0 구성과 장중 15분 주기(D-012). 가입 후 확인할 것은 개발 단계로 미룸: Databento 적재 견적, Massive Basic 정산가 필드, Databento·Massive 정산가 일치 여부
  - ② CME 달력 (2026-10-22 완료, `docs/research/cme-calendar.md`): 휴장·조기 마감·공휴일 중간 정지, 최종 거래일 규칙(소스의 계약 정의 값 저장), 금속 상장·활성 월물
  - Step 2 리서치 항목: 한국형·미국형 롤 규칙, ETP 목록·속성 소스(ETN 후속 시리즈 묶기 기준 포함), 커브 거래량 기준, ETP 순자산(AUM) 수집 가능 여부, 일일 정산 배치 시각(Massive EOD 반영 시각 실측), ETP 원천 갱신 시각, 과거 데이터 보관 범위(C-b 기준일 하한), B 설정의 데이터 출처 문구
  - Step 2 데이터 모델 반영(2026-10-22 완료, `docs/data-model.md`): 사용자 시간대(IANA)·언어, 알림 거부 시간, 보류 알림, 알림 발송 기록(중복 방지 키, D-006), 기기별 푸시 토큰, ETP와 ETN 시리즈, 활성 월물 달력, 거래 달력(휴장·조기 마감). D-011로 사용자 테이블을 단일 행 `app_settings`로 정리
  - Step 2 산출물: 데이터 모델(Mermaid erDiagram), 외부 연동, `docs/research/`, `docs/decisions.md` D-010~

## 2. Tech Stack 결정
기획(1)의 기능 요구사항을 기준으로 결정한다.

- [ ] 프레임워크 구성: Expo vs React Native CLI
- [ ] 언어 / 패키지 매니저
- [ ] 내비게이션, 상태 관리, 데이터 패칭
- [ ] UI / 스타일링
- [ ] Backend / DB / 서버 접근 보호 (자체 서버 vs BaaS, 단일 사용자)
- [ ] 테스트 도구, lint / format
- [ ] 빌드 / 설치 (CI, 본인 기기 설치: iOS 유료 개발자 계정·TestFlight 또는 개발 빌드, Android APK)
- [ ] 결정된 스택 기준으로 CLAUDE.md Key Patterns / Coding Conventions 정리 (default export 금지 규칙과 라우터 요구사항 충돌 여부, API 응답·에러 규약 확정)

## 3. Architecture 결정
- [ ] 디렉터리 구조
- [ ] 레이어 구성 (UI / 상태 / 데이터 접근)
- [ ] API 통신 및 에러 처리 규약
- [ ] 환경 설정 분리 (dev / prod)

## 4. 프로젝트 생성
- [x] git init 및 .gitignore (스캐폴딩 시 생성되는 .gitignore와 병합 필요)
- [ ] 프로젝트 스캐폴딩
- [ ] lint / format / test 설정
- [ ] Android / iOS 시뮬레이터에서 실행 확인
- [ ] CLAUDE.md 갱신 (Tech Stack, Architecture, Commands)
- [ ] SessionStart hook(~/.claude/hooks/swift-env.sh)에 Node 버전 주입 추가 (package.json 존재 시)

## 5. 개발
- 개발 부분의 세부 항목은 이전 단계가 마무리된 이후 정리
- [ ] 원격 저장소 생성 및 연결 (GitHub, private) 후 push: 앱을 기기에 설치해 쓸 수 있는 시점에 진행 (2026-10-22 결정)
- 적절한 개발 전략 수립 : harness, agent-teams(frontend, backend, db, review, test) 구성

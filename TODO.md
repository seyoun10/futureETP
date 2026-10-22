# TODO

목표: React Native로 Android/iOS 앱 개발
지침: 이 파일 내용을 순차적으로 진행하면서 이후 내용을 적적하게 업데이트

## 1. 앱 서비스 기획
Claude가 이후 작업할 때 참고하는 문서. 기술 결정의 입력이 된다.

- [ ] 서비스 개요: 목적, 대상 사용자, 핵심 가치 (초안 작성, 역검증 대기)
- [ ] 핵심 기능 목록 및 MVP 범위 (초안 작성, 역검증 대기)
- [ ] 사용자 흐름(user flow) / 화면 목록 (초안 작성, 역검증 대기)
- [ ] 화면 와이어프레임(이미지 또는 다이어그램) (`docs/wireframes/screens.md`, 2026-10-22 화면 구조 재정의 반영(D-001), 세부 역검증 대기)
- [ ] **[다음 작업] Step 1 역검증**: Claude가 `docs/product.md`와 `docs/wireframes/screens.md`를 항목별로 하나씩 사용자에게 설명하고, 사용자가 의도와 맞는지 확인한다
  - 2026-10-22: 와이어프레임 큰 틀(화면 구조·A/B/C 화면) 먼저 확정. product.md 기능·흐름·설정을 그에 맞춰 갱신함
  - 남은 순서: 범위 → 용어 → 계산 정의(기준값, 시계열, 이격도·rare, 월물 목록, 커브) → 전역 설정 → 기능 1~8 → 서버 배치 → 사용자 흐름·화면 → 와이어프레임 세부 → 위험·미결정
  - 어긋난 부분은 그 자리에서 문서를 고친다. 끝나면 커밋한다: `docs: draft service overview, features, flows and wireframes`
  - 기획 근거(계획 원본): `~/.claude/plans/todo-md-recursive-milner.md`
- [ ] 데이터 모델 초안 (주요 엔티티와 관계) — Step 2, 역검증 후 진행
- [ ] 외부 연동 요구사항 (인증, 결제, 푸시, 외부 API 등) — Step 2, 역검증 후 진행
  - Step 2 리서치: 한국형·미국형 롤 규칙, 선물 시세 소스 비교표(무료·상업적 이용·장중·만기 월물 이력), 시세 새로고침 주기(실시간/지연) 제약, ETP 목록·속성 소스, WTI/Brent, 커브 거래량 기준, CME 휴장일 소스
  - Step 2 산출물: 데이터 모델(Mermaid erDiagram), 외부 연동, `docs/decisions.md` D-002~

## 2. Tech Stack 결정
기획(1)의 기능 요구사항을 기준으로 결정한다.

- [ ] 프레임워크 구성: Expo vs React Native CLI
- [ ] 언어 / 패키지 매니저
- [ ] 내비게이션, 상태 관리, 데이터 패칭
- [ ] UI / 스타일링
- [ ] Backend / DB / 인증 (자체 서버 vs BaaS)
- [ ] 테스트 도구, lint / format
- [ ] 빌드 / 배포 (CI, 스토어 배포)
- [ ] 결정된 스택 기준으로 CLAUDE.md Key Patterns / Coding Conventions 정리 (Next.js 전용 규칙 제거 등)

## 3. Architecture 결정
- [ ] 디렉터리 구조
- [ ] 레이어 구성 (UI / 상태 / 데이터 접근)
- [ ] API 통신 및 에러 처리 규약
- [ ] 환경 설정 분리 (dev / prod)

## 4. 프로젝트 생성
- [x] git init 및 .gitignore (스캐폴딩 시 생성되는 .gitignore와 병합 필요)
- [ ] 원격 저장소 생성 및 연결 (GitHub, private) 후 push
- [ ] 프로젝트 스캐폴딩
- [ ] lint / format / test 설정
- [ ] Android / iOS 시뮬레이터에서 실행 확인
- [ ] CLAUDE.md 갱신 (Tech Stack, Architecture, Commands)
- [ ] SessionStart hook(~/.claude/hooks/swift-env.sh)에 Node 버전 주입 추가 (package.json 존재 시)

## 5. 개발
- 개발 부분의 세부 항목은 이전 단계가 마무리된 이후 정리
- 적절한 개발 전략 수립 : harness, agent-teams(frontend, backend, db, review, test) 구성

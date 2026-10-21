# TODO

목표: React Native로 Android/iOS 앱 개발

## 1. 앱 서비스 기획
Claude가 이후 작업할 때 참고하는 문서. 기술 결정의 입력이 된다.

- [ ] 서비스 개요: 목적, 대상 사용자, 핵심 가치
- [ ] 핵심 기능 목록 및 MVP 범위
- [ ] 사용자 흐름(user flow) / 화면 목록
- [ ] 화면 와이어프레임(이미지 또는 다이어그램)
- [ ] 데이터 모델 초안 (주요 엔티티와 관계)
- [ ] 외부 연동 요구사항 (인증, 결제, 푸시, 외부 API 등)

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
- [ ] 프로젝트 스캐폴딩
- [ ] lint / format / test 설정
- [ ] Android / iOS 시뮬레이터에서 실행 확인
- [ ] CLAUDE.md 갱신 (Tech Stack, Architecture, Commands)
- [ ] SessionStart hook(~/.claude/hooks/swift-env.sh)에 Node 버전 주입 추가 (package.json 존재 시)

## 5. 개발
- 개발 부분의 세부 항목은 이전 단계가 마무리된 이후 정리
- 적절한 개발 전략 수립 : harness, agent teams 구성/설정

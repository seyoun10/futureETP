# Tech Stack

> TODO.md 2단계 산출물. product.md의 기능 요구사항 기준으로 결정한다.
> 결정 근거는 decisions.md에 기록하고 여기에는 결과만 적는다.

| 영역 | 선택 | 결정 기록 |
|---|---|---|
| 프레임워크 (Expo / RN CLI) | Expo(개발 빌드, CNG: 네이티브 폴더는 prebuild로 생성·미커밋) | D-027 |
| 언어 / 패키지 매니저 | TypeScript(strict) / npm | D-028 |
| 내비게이션 | Expo Router (route 파일만 default export) | D-029 |
| 상태 관리 | Zustand v5 + persist(`expo-sqlite/kv-store`), 기기별 표시 설정만 | D-030 |
| 데이터 패칭 | TanStack Query v5 + `fetch` 래퍼, 영속 캐시 없음 | D-030 |
| UI / 스타일링 | | |
| 차트 라이브러리 | | |
| i18n | | |
| Backend / DB / 서버 접근 보호 | | |
| 배치 스케줄러 / 호스팅 | | |
| 푸시 (FCM·APNs 직접 / 중계) | | |
| 테스트 / lint / format | | |
| 빌드 / 배포 | | |

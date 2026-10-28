# Tech Stack

> TODO.md 2단계 산출물. product.md의 기능 요구사항 기준으로 결정한다.
> 결정 근거는 decisions.md에 기록하고 여기에는 결과만 적는다.

| 영역 | 선택 | 결정 기록 |
|---|---|---|
| 프레임워크 (Expo / RN CLI) | Expo SDK 58(RN 0.88, React 19.3, 개발 빌드, CNG: 네이티브 폴더는 prebuild로 생성·미커밋) | D-027, D-050 |
| 언어 / 패키지 매니저 | TypeScript(strict, 앱은 SDK가 고정한 ~6.0) / npm, Node 26(`.nvmrc`·`engines`) | D-028, D-050 |
| 내비게이션 | Expo Router (route 파일만 default export) | D-029 |
| 상태 관리 | Zustand v5(5.0.16) + persist(`expo-sqlite/kv-store` 동기 API), 기기별 UI 설정(언어·등락 색·기간 선택)만 | D-030, D-047, D-073 |
| 데이터 패칭 | TanStack Query v5(`@tanstack/react-query` 5.105.0) + `fetch` 래퍼(`src/api`, 응답은 shared zod 스키마로 검증), 영속 캐시 없음 | D-030, D-042, D-072 |
| UI / 스타일링 | `StyleSheet` + typed 테마 토큰(다크 전용), UI 키트 없음. 날짜 선택은 `@react-native-community/datetimepicker` 9.2.1(Android 다이얼로그, iOS `Modal` 시트) | D-031, D-091 |
| 차트 라이브러리 | Victory Native XL(`victory-native` 42.0.1 고정) + Skia 커스텀 레이어 (C-a 스파이크 통과: y 맞춤·x축·범위 제한은 직접 구현) | D-032, D-050, D-056 |
| i18n | i18next 26.5 + react-i18next 17.1, `expo-localization`, 숫자·날짜는 `Intl`, 키는 `ko` 기준 타입 검사 | D-033, D-073 |
| Backend / DB / 서버 접근 보호 | TypeScript(Node 타입 스트리핑, 빌드 없음, TS ~6.0) + Hono·zod·Drizzle(0.45, 드라이버 `pg`, 적용은 코드 `migrate()`), PostgreSQL 18, npm workspaces로 앱과 공유 패키지 / Caddy HTTPS + Bearer 비밀 토큰 | D-035, D-036, D-051, D-053, D-059 |
| 배치 스케줄러 / 호스팅 | 프로세스 내 `croner` 10.0.1(작업별 IANA 시간대, D-060) / Oracle Always Free ARM VM 1대 + Docker Compose(PAYG 전환) | D-034 |
| 푸시 (FCM·APNs 직접 / 중계) | 직접 연동: 앱 `getDevicePushTokenAsync`, 서버 `firebase-admin`(FCM v1)·`@parse/node-apn`(APNs). Android 먼저, APNs는 Apple 가입 뒤 | D-037 |
| 테스트 / lint / format | 앱 jest-expo + RNTL, 서버·공유 Vitest / ESLint 9(루트 설정 하나, eslint-config-expo는 앱만, typescript-eslint 타입 기반, `no-restricted-exports`로 default export 금지·`src/app/**`·설정 파일 예외) + Prettier(Markdown 제외) / husky + lint-staged(pre-commit 바뀐 파일만 `eslint --fix` → `prettier --write`), `npm run check` | D-038, D-054 |
| 빌드 / 배포 | Android 로컬 빌드(개발 빌드 + release APK, EAS Build 예비, Zulu JDK 17·SDK 37·에뮬레이터 API 36) / iOS는 Apple 가입 전 시뮬레이터만 / OTA는 EAS Update(fingerprint) / CI는 원격 저장소 생성 때 Actions로 `npm run check` / 서버는 rsync + VM에서 `docker compose up --build` | D-039, D-055 |

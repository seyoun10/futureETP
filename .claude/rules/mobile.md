---
paths:
  - 'apps/mobile/**'
---

# 앱(apps/mobile) 규칙

## Stack

- Expo 개발 빌드 + CNG(네이티브 폴더 미커밋), Expo Router, TanStack Query + Zustand, StyleSheet + 테마 토큰(다크 전용), Victory Native XL + Skia, i18next(ko/en) (D-027~D-033)
- Test: jest-expo + RNTL 14
- Build: Android 로컬 빌드(Zulu JDK 17, 에뮬레이터 `Pixel_API_36`), iOS는 Apple 가입 전 시뮬레이터만 (D-039, D-055)

## Architecture

- route → 화면(`src/features/`, named export) → query hook → `src/api`. 컴포넌트에서 `fetch` 직접 호출 금지 (D-041)
- `extra`(서버 주소·dev 토큰)는 `src/api/config.ts`에서만 읽는다 (D-043, D-052)

## Patterns

- API 호출은 `fetch` 래퍼 + TanStack Query, 에러는 `AppError` class로 통일 (D-030)
- 서버 상태는 TanStack Query, 기기별 UI 설정(언어·등락 색)만 Zustand persist (D-030, D-047). 예외: C 탭 하단 기준 시각 줄 전달용 비영속 `stores/footerFreshness`. C-a·C-c 기간은 원자재 스택의 화면 상태 (D-107)
- 차트에 쓰는 색은 테마 토큰에서, 등락 색은 표시 설정에서 읽는다 (D-031)
- 사용자에게 보이는 문구는 i18n 키로만 쓴다 (D-033)
- 서버 접근 키는 SecureStore에만 둔다. 앱 번들·app config·저장소에 넣지 않는다. 예외는 dev 변형의 `DEV_API_TOKEN`뿐 (D-043, D-044)
- 테스트는 RNTL 14라 `await render(...)`로 쓴다 (D-054)

## Conventions

- component: PascalCase, util/hook: camelCase
- React component는 named export 사용 (default export 금지). 예외: `src/app/` 아래 Expo Router route 파일(`_layout` 포함)은 default export만 하고, `src/app/` 밖의 named export 화면을 다시 내보내기만 한다 (D-029, D-050)
- `@/` = `apps/mobile/src/` 별칭을 쓴다 (D-050)

## Commands

- `npm run start -w apps/mobile`(dev 변형), `npm run android:dev -w apps/mobile`, `npm run ios:dev -w apps/mobile`. gradle을 직접 부를 때는 `APP_VARIANT=development`를 붙인다
- 단일 테스트: `npm test -w apps/mobile -- CommodityListScreen -t "렌더링"`
- `apps/mobile/package.json`의 `scripts`·의존성을 바꾸면 fingerprint가 바뀌어 설치된 빌드가 OTA(`npm run update:prod`)를 못 받는다(새로 빌드 필요)

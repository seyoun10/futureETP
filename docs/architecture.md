# Architecture

> TODO.md 3단계 산출물.

## 디렉터리 구조

npm workspaces 모노레포(D-035, D-040). 라우트 세부 파일명은 4단계 스캐폴딩 때 Expo Router 동작에 맞춰 확정한다.

```
futureETP/
├─ apps/
│  ├─ mobile/                      Expo 앱
│  │  ├─ app/                      Expo Router route 파일만 (default export 재내보내기, D-029)
│  │  │  ├─ _layout.tsx
│  │  │  ├─ index.tsx              A 원자재 목록
│  │  │  ├─ settings/              B 설정(index), B-a 알림 설정(alerts)
│  │  │  └─ commodity/[code]/      C (_layout = 상단 탭), C-a~C-d 탭, etp/[id] = C-d-a
│  │  └─ src/
│  │     ├─ features/              화면 단위: 화면·전용 컴포넌트·query hook
│  │     │                         commodity-list, settings, alert-settings,
│  │     │                         commodity(disparity-chart, curve, contract-chart, etp)
│  │     ├─ components/            여러 화면 공용 UI
│  │     ├─ charts/                Skia 커스텀 레이어·차트 공용 (D-032)
│  │     ├─ api/                   fetch 래퍼, AppError, query key (D-030)
│  │     ├─ stores/                Zustand 표시 설정 (D-030)
│  │     ├─ theme/                 테마 토큰, 등락 색 함수 (D-031)
│  │     ├─ i18n/                  i18next 설정, ko/en 리소스 (D-033)
│  │     ├─ push/                  토큰 등록·알림 탭 처리 (D-037)
│  │     └─ lib/                   포맷(Intl, 소수 자릿수) 등 순수 유틸
│  └─ server/
│     ├─ Dockerfile                빌드 문맥 = 저장소 루트 (shared·lock 파일 포함)
│     └─ src/
│        ├─ main.ts                API + 스케줄러 한 프로세스 (D-034)
│        ├─ api/                   Hono 라우트·미들웨어(Bearer 검사, 횟수 제한, D-036)
│        ├─ jobs/                  croner 배치 진입점(일일 정산·장중·지연 발송·ETP 목록·거래일 달력)
│        ├─ calc/                  지수·롤 비중·이평선·이격도·분포·커브 순수 함수
│        ├─ sources/               외부 수집기(Databento·Massive·Yahoo·Naver·KRX·Nasdaq)
│        ├─ push/                  FCM·APNs 발송 인터페이스 (D-037)
│        └─ db/                    Drizzle 스키마, 마이그레이션, 조회
├─ packages/
│  └─ shared/                      API 계약: zod 스키마, 공용 타입·enum, 푸시 문구 리소스
├─ infra/                          docker-compose.yml, Caddyfile
├─ scripts/                        배포(rsync + compose), Databento 1회 적재, 달력 생성 보조
├─ docs/
└─ package.json                    workspaces ["apps/*", "packages/*"], `npm run check`
```

규칙
- 의존 방향은 mobile → shared, server → shared만 허용한다. mobile과 server는 서로 import하지 않는다.
- `packages/shared`는 빌드 없이 TS 소스를 직접 export한다. 계산 코드는 넣지 않는다(앱은 계산하지 않음).
- 앱 `@/` 별칭은 `apps/mobile/src`를 가리킨다. 화면 구현은 `src/features/` 아래 named export로 둔다.
- 화면 전용 코드는 해당 feature 안에 두고, 두 곳 이상에서 쓰게 되면 공용 계층(`components`·`charts`·`lib` 등)으로 옮긴다.
- 서버 `jobs/`는 스케줄과 실행 기록(`batch_run`)만 맡고, 수집·계산·저장·발송은 `sources`·`calc`·`db`·`push`를 호출한다. `calc/`는 DB·네트워크에 의존하지 않아 Vitest 단위 테스트의 핵심 대상이다(D-038).
- 스캐폴딩 때 확인할 것(D-040 후속): 기본 템플릿의 route 폴더 위치(`app/`/`src/app/`), 서버 실행 방식과 shared 소스 직접 참조 호환성, React Native 중복 설치 시 npm `overrides`.

## 레이어 구성 (UI / 상태 / 데이터 접근)

## API 통신 및 에러 처리 규약

## 환경 설정 분리 (dev / prod)

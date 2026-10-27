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

D-041. 위 계층은 아래 계층만 호출한다(아래에서 위로, 또는 계층을 건너뛰는 호출 금지).

앱 (`apps/mobile`)

| 계층 | 위치 | 맡는 일 | 하지 않는 일 |
|---|---|---|---|
| route | `app/` | 화면 컴포넌트 재내보내기, 레이아웃(스택·상단 탭) | 로직, 데이터 조회 |
| 화면·컴포넌트(UI) | `src/features/*`, `src/components`, `src/charts` | 렌더링, 사용자 입력, 로딩·오류·빈 상태 표시 | `fetch` 직접 호출, 서버 데이터 복사 저장 |
| 상태 | `src/features/*/use*Query.ts`·`use*Mutation.ts`(서버 상태), `src/stores`(표시 설정) | TanStack Query hook(query key, 새로고침 시점, 뮤테이션 뒤 무효화), Zustand 표시 설정 | HTTP 세부 처리 |
| 데이터 접근 | `src/api` | 엔드포인트 함수(경로·파라미터·응답 스키마), `fetch` 래퍼(인증 헤더, 타임아웃, 응답 검증, `AppError` 변환) | 캐시, 화면 상태 |

- 서버 데이터는 TanStack Query 캐시에만 둔다. Zustand에는 표시 설정(언어·등락 색)만 둔다(D-030). 서버에 저장하는 설정(이격도차트·알림)도 query·mutation으로 다룬다.
- 화면 안에서만 쓰는 일시 상태(선택한 기준일, 십자선 위치, 가로 모드 등)는 컴포넌트 상태(`useState`·Reanimated shared value)로 둔다.
- 순수 계산(가격 포맷, 등락 색 선택, 차트 좌표 변환)은 `src/lib`·`src/theme`·`src/charts`의 함수로 두어 컴포넌트 밖에서 테스트한다.

서버 (`apps/server`)

| 계층 | 위치 | 맡는 일 |
|---|---|---|
| 진입점 | `src/api`(Hono 라우트), `src/jobs`(croner 배치) | 요청 검증(zod)·응답 봉투 / 스케줄·실행 기록(`batch_run`)·재시도 |
| 작업 흐름 | `src/jobs`의 배치별 함수, 라우트 핸들러 | 수집 → 계산 → 저장 → 발송 순서 조합 |
| 도메인 계산 | `src/calc` | 순수 함수(입력 배열 → 결과). DB·네트워크·시각 의존 없음(현재 시각도 인자로 받음) |
| 외부 연동 | `src/sources`, `src/push` | 외부 API 호출과 응답을 내부 타입으로 변환 / FCM·APNs 발송 결과를 공통 결과 타입으로 변환 |
| 데이터 접근 | `src/db` | Drizzle 스키마와 조회·저장 함수. 별도 repository 추상화는 두지 않는다 |

- 조회 API는 계산하지 않는다. 배치가 미리 계산해 저장한 값을 `db` 조회 함수로 읽어 응답 형태로 바꾸기만 한다(product.md "앱은 자체 백엔드만 조회하고, 계산은 모두 서버에서 미리 한다").
- `calc`는 `db`·`sources`를 import하지 않는다. 테스트는 `calc`(단위)와 배치 흐름(가짜 `sources`·`push` 주입)을 중심으로 한다(D-038).

## API 통신 및 에러 처리 규약

D-042. 스키마·에러 코드·enum은 `packages/shared`에 한 벌만 두고 앱·서버가 함께 쓴다.

### 요청
- 기본 경로 `https://<호스트>/v1`. JSON만 쓴다. 조회는 `GET`, 설정 변경은 `PATCH`, 기기 등록은 `PUT`(멱등 upsert).
- `/v1/health`를 뺀 모든 요청에 `Authorization: Bearer <비밀 값>`(D-036).
- 필드 이름은 camelCase. 서버는 path·query·body를 zod로 검증한다(Hono validator).

### 응답 봉투
모든 응답(성공·실패)은 판별 유니언 하나로 보낸다. HTTP 상태 코드도 함께 맞춘다.

```ts
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: ApiErrorCode; message: string } };
```

| `code` | HTTP | 언제 |
|---|---|---|
| `UNAUTHORIZED` | 401 | 비밀 값 없음·불일치 |
| `RATE_LIMITED` | 429 | 인증 실패 횟수 제한 초과 |
| `VALIDATION_FAILED` | 400 | path·query·body 검증 실패 |
| `NOT_FOUND` | 404 | 없는 경로·원자재·ETP |
| `INTERNAL` | 500 | 그 밖의 서버 오류 |

- `message`는 개발·로그용 영문이다. 사용자에게 보이지 않는다. 사용자 문구는 앱이 `code`를 i18n 키(`errors.<code>`)로 바꿔 보여 준다(D-033).
- 서버는 `onError`·`notFound`에서도 같은 봉투를 보낸다. 스택 트레이스는 응답에 넣지 않고 서버 로그(stdout)에만 남긴다.

### 값 형식
- 시각: UTC ISO 8601 문자열(`2026-10-22T14:30:00Z`). 앱이 기기 현지 시간으로 바꿔 표시한다.
- CME 거래일: `YYYY-MM-DD` 문자열(달력 날짜와 다를 수 있음, data-model 공통 규약).
- 가격·이격도·백분위: JSON number. DB는 decimal로 계산·저장하고 응답을 만들 때만 number로 바꾼다. 앱은 표시만 하므로 double 정밀도로 충분하다.
- enum: shared 상수 문자열(`GC`, `FRONT`, `Y10`, `UP` 등, data-model과 같은 값).

### 데이터 기준 정보(freshness)
A와 C 화면의 조회 응답 `data`에는 상단 기준 시각 줄과 자동 새로고침에 쓰는 `freshness`를 넣는다.

```ts
type Freshness = {
  asOf: string;            // 데이터 기준 시각(UTC)
  tradeDate: string;       // CME 거래일
  delayed: boolean;        // 지연 시세 여부
  marketState: 'OPEN' | 'CLOSED' | 'SETTLEMENT_PENDING';
  nextUpdateAt: string | null; // 다음 장중 배치 완료 예상 시각, 장중이 아니면 null
};
```

- 앱은 화면이 보이는 동안 `nextUpdateAt` + 여유 1분에 해당 query를 다시 조회한다(D-030 후속). `null`이면 자동 새로고침하지 않고 당겨서 새로고침과 앱 복귀 재조회만 한다.

### 앱 fetch 래퍼와 AppError
- `src/api`의 래퍼가 인증 헤더, 타임아웃(15초, `AbortSignal.timeout`), JSON 파싱, shared 스키마로 봉투·`data` 검증(`zod` parse)을 맡고, 실패는 모두 `AppError`로 던진다.
- `AppError`는 `code`(서버 코드 + 앱 코드 `NETWORK`·`TIMEOUT`·`SCHEMA_MISMATCH`), `status?`(HTTP), `cause?`를 가진다. 화면은 `code`만 보고 문구를 고른다.
- 재시도(TanStack Query `retry`): `NETWORK`·`TIMEOUT`·`INTERNAL`만 최대 2회. 4xx와 `SCHEMA_MISMATCH`는 재시도하지 않는다. mutation은 자동 재시도하지 않는다.
- 화면 표시: 처음 로딩 실패는 오류 화면 + [다시 시도]. 이미 데이터가 있는 상태의 새로고침 실패는 기존 데이터를 유지하고 기준 시각 줄로 오래됨을 알린다(product.md 배치 실패 시).
- `UNAUTHORIZED`의 화면 처리는 비밀 값 저장·교체 항목(TODO 3단계)에서 정한다.

### 엔드포인트 초안
개발 단계에서 응답 필드를 정하면서 고친다. 차트 구간 로딩·커브 캐시는 TODO 3단계 남은 항목에서 정한다.

| 메서드·경로 | 화면 | 내용 |
|---|---|---|
| `GET /v1/health` | — | 인증 없음, 배포 확인용 |
| `GET /v1/commodities` | A | 원자재별 월물 5개 시세, 대표월물, 알림 표시, freshness |
| `GET /v1/commodities/:code/disparity?basis&ma&window` | C-a | 지수 일봉, 이평선, rare-level 밴드, 롤 구간, freshness |
| `GET /v1/commodities/:code/curve?baseDate` | C-b | 기준일·현재 커브, 스프레드·롤 수익률, freshness |
| `GET /v1/commodities/:code/contracts` | C-c | 월물 5개 원가격 시계열, freshness |
| `GET /v1/commodities/:code/etps` | C-d | ETP 목록(필터·정렬은 앱에서) |
| `GET /v1/etps/:id` | C-d-a | ETP 상세 |
| `GET /v1/settings`, `PATCH /v1/settings` | B, B-a | 이격도차트·알림 설정, 언어(푸시 문구용) |
| `PUT /v1/devices` | 앱 실행 | 푸시 토큰·플랫폼·앱 버전 upsert(`pushToken` 기준), 시간대는 `app_settings.timezone` 갱신 |

## 환경 설정 분리 (dev / prod)

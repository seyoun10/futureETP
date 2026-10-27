# Architecture

> TODO.md 3단계 산출물.

## 디렉터리 구조

npm workspaces 모노레포(D-035, D-040). route 폴더는 SDK 58 템플릿 기본값인 `src/app/`이다(D-050). 라우트 세부 파일명은 화면을 만들 때 Expo Router 동작에 맞춰 정한다.

```
futureETP/
├─ apps/
│  ├─ mobile/                      Expo 앱
│  │  └─ src/
│  │     ├─ app/                   Expo Router route 파일만 (default export 재내보내기, D-029, D-050)
│  │     │  ├─ _layout.tsx
│  │     │  ├─ index.tsx           A 원자재 목록
│  │     │  ├─ settings/           B 설정(index), B-a alerts, B-b access-key, data-sources (D-074)
│  │     │  └─ commodity/[code]/   Stack: (tabs)/ 하단 탭 index(C-a)·curve·contracts·etps, 탭 밖 etp/[id] = C-d-a (D-047, D-074)
│  │     ├─ features/              화면 단위: 화면·전용 컴포넌트·query hook
│  │     │                         commodity-list, settings, alert-settings, access-key,
│  │     │                         commodity(disparity-chart, curve, contract-chart, etp)
│  │     ├─ components/            여러 화면 공용 UI(header, `FreshnessLine`, `QueryStateView`, D-075)
│  │     ├─ charts/                Skia 커스텀 레이어·차트 공용 (D-032)
│  │     ├─ api/                   fetch 래퍼, AppError, query key, `useAutoRefresh` (D-030, D-075)
│  │     ├─ stores/                Zustand 표시 설정 (D-030, D-073)
│  │     ├─ theme/                 테마 토큰, 등락 색 함수 (D-031, D-073)
│  │     ├─ i18n/                  i18next 설정(`setupI18n`), ko/en 리소스 (D-033, D-073)
│  │     ├─ push/                  토큰 등록·알림 탭 처리 (D-037)
│  │     └─ lib/                   포맷(Intl, 소수 자릿수) 등 순수 유틸
│  └─ server/
│     ├─ Dockerfile                빌드 문맥 = 저장소 루트 (shared·lock 파일 포함)
│     └─ src/
│        ├─ main.ts                API + 스케줄러 한 프로세스 (D-034)
│        ├─ api/                   Hono 라우트·미들웨어(Bearer 검사, 횟수 제한, D-036)
│        ├─ jobs/                  croner 배치 진입점(일일 정산·장중·지연 발송·ETP 목록·달력 점검·백업), 러너·CLI (D-060)
│        ├─ calc/                  지수·롤 비중·이평선·이격도·분포·커브 순수 함수
│        ├─ sources/               외부 수집기(Databento·Massive·Yahoo·Naver·KRX·Nasdaq)
│        ├─ push/                  FCM·APNs 발송 인터페이스 (D-037)
│        └─ db/                    Drizzle 스키마, 마이그레이션, 조회
├─ packages/
│  └─ shared/                      API 계약: zod 스키마, 공용 타입·enum, 푸시 문구 리소스
├─ infra/                          docker-compose.yml, Caddyfile
├─ scripts/                        배포(rsync + compose), Databento 1회 적재, 달력 입력 파일(`calendar/<연도>.json`, D-061),
│                                  백업 내려받기·dev 복원, 접근 키 생성·QR 표시
├─ docs/
└─ package.json                    workspaces ["apps/*", "packages/*"], `npm run check`
```

규칙
- 의존 방향은 mobile → shared, server → shared만 허용한다. mobile과 server는 서로 import하지 않는다.
- `packages/shared`는 빌드 없이 TS 소스를 직접 export한다. 계산 코드는 넣지 않는다(앱은 계산하지 않음).
- 앱 `@/` 별칭은 `apps/mobile/src`를 가리킨다. 화면 구현은 `src/features/` 아래 named export로 둔다.
- 화면 전용 코드는 해당 feature 안에 두고, 두 곳 이상에서 쓰게 되면 공용 계층(`components`·`charts`·`lib` 등)으로 옮긴다.
- 월물 심볼은 DB·API·화면에서 표준형(`CLZ26`)만 쓴다. 소스별 표기(Yahoo `CLZ26.NYM`·`GCZ26.CMX`, Databento `CLZ6`, Massive는 가입 후 확인)는 `sources/`의 각 수집기가 변환한다(D-049).
- 서버 `jobs/`는 스케줄과 실행 기록(`batch_run`)만 맡고, 수집·계산·저장·발송은 `sources`·`calc`·`db`·`push`를 호출한다. `calc/`는 DB·네트워크에 의존하지 않아 Vitest 단위 테스트의 핵심 대상이다(D-038).
- 루트 `package.json`의 `overrides`로 `react`·`react-native`를 앱과 같은 버전 하나로 고정한다. workspaces에서 peer로 끌어올려진 최신 `react`가 앱의 고정 버전과 따로 설치되는 것을 막는다(D-050). Expo SDK를 올릴 때 함께 고친다.
- 서버는 빌드 없이 Node 타입 스트리핑으로 `src/main.ts`를 바로 실행한다. 서버·shared는 ESM, 상대 import에 `.ts` 확장자, `erasableSyntaxOnly`(enum·namespace 금지)를 지킨다. Docker 이미지에서도 shared는 workspaces 심볼릭 링크로 둔다(`node_modules` 아래 TS는 Node가 실행하지 않음, D-051).

## 레이어 구성 (UI / 상태 / 데이터 접근)

D-041. 위 계층은 아래 계층만 호출한다(아래에서 위로, 또는 계층을 건너뛰는 호출 금지).

앱 (`apps/mobile`)

| 계층 | 위치 | 맡는 일 | 하지 않는 일 |
|---|---|---|---|
| route | `src/app/` | 화면 컴포넌트 재내보내기, 레이아웃(스택·하단 탭, 스와이프 전환 없음, D-047) | 로직, 데이터 조회 |
| 화면·컴포넌트(UI) | `src/features/*`, `src/components`, `src/charts` | 렌더링, 사용자 입력, 로딩·오류·빈 상태 표시 | `fetch` 직접 호출, 서버 데이터 복사 저장 |
| 상태 | `src/features/*/use*Query.ts`·`use*Mutation.ts`(서버 상태), `src/stores`(표시 설정) | TanStack Query hook(query key, 새로고침 시점, 뮤테이션 뒤 무효화), Zustand 표시 설정 | HTTP 세부 처리 |
| 데이터 접근 | `src/api` | 엔드포인트 함수(경로·파라미터·응답 스키마), `fetch` 래퍼(인증 헤더, 타임아웃, 응답 검증, `AppError` 변환) | 캐시, 화면 상태 |

- 서버 데이터는 TanStack Query 캐시에만 둔다. Zustand에는 기기별 UI 설정(언어·등락 색·C-a/C-c 기간 선택)만 둔다(D-030, D-047). 서버에 저장하는 설정(이격도차트·알림)도 query·mutation으로 다룬다.
- 화면 안에서만 쓰는 일시 상태(선택한 기준일, 십자선 위치 등)는 컴포넌트 상태(`useState`·Reanimated shared value)로 둔다.
- 가로 모드는 상태로 두지 않는다. `src/lib/orientation.ts`의 잠금 함수로 방향을 바꾸고, 레이아웃은 `useIsLandscape`(창 모양)로 정한다. 앱은 세로로 잠그고 C-a~C-c [⟲]만 가로로 잠근다(D-076).
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
- 예외(D-046): 커브(C-b) 조회만 저장값 대신 `daily_bar`·`intraday_snapshot` 원천값을 읽어 `calc`의 커브 함수(월물 선택·스프레드·롤 수익률)를 부른다. 기준일이 2010년부터 아무 날이나 될 수 있어 미리 저장하지 않는다(D-010). 계산 코드 자체는 `calc`에만 둔다.
- 예외(D-086): C-a 조회는 저장된 분포·유효 종가로 `calc`의 rare 레벨·꼬리 백분위·오늘 잠정 이평선을 부른다. rare 레벨은 사용자가 바꾸는 값이라 미리 저장할 수 없다. 기간별 rare-level 선은 앱이 `ma(t) × (1 + 레벨 이격도 / 100)`로 그린다.
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
- 서버 라우트는 `ok(c, data)`로 응답하고 실패는 `ApiException(code, message)`을 던진다(`src/api/`, D-059).
- 인증 실패 횟수 제한(D-059): IP(`X-Forwarded-For` 가장 오른쪽 값, 없으면 소켓 주소)별로 15분 안에 10회 실패하면 그 창이 끝날 때까지 그 IP의 `/v1/health` 밖 요청이 모두 `RATE_LIMITED`다. 인증 없이 없는 경로를 부르면 `NOT_FOUND`가 아닌 `UNAUTHORIZED`다.

### 값 형식
- 시각: UTC ISO 8601 문자열(`2026-10-22T14:30:00Z`). 앱이 기기 현지 시간으로 바꿔 표시한다.
- CME 거래일: `YYYY-MM-DD` 문자열(달력 날짜와 다를 수 있음, data-model 공통 규약).
- 가격·이격도·백분위: JSON number. DB는 decimal로 계산·저장하고 응답을 만들 때만 number로 바꾼다. 앱은 표시만 하므로 double 정밀도로 충분하다.
- enum: shared 상수 문자열(`GC`, `FRONT`, `Y10`, `UP` 등, data-model과 같은 값).

### 데이터 기준 정보(freshness)
A와 C 화면의 조회 응답 `data`에는 상단 기준 시각 줄과 자동 새로고침에 쓰는 `freshness`를 넣는다.
스키마는 shared `freshnessSchema`, 앱 표시는 `src/components/FreshnessLine.tsx`(포맷은 `src/lib/formatDateTime.ts`)다(D-075). 시세 숫자·월물 표기(`2,405.1`·`+0.51%`·`DEC26`)는 언어와 상관없이 `src/lib/formatNumber.ts`가 만든다.

```ts
type Freshness = {
  asOf: string;            // 데이터 기준 시각(UTC)
  tradeDate: string;       // CME 거래일
  delayed: boolean;        // 지연 시세 여부
  marketState: 'OPEN' | 'CLOSED' | 'SETTLEMENT_PENDING';
  nextUpdateAt: string | null; // 다음 데이터 갱신 예상 시각(아래), 계산할 수 없으면 null
};
```

- 표시 값: 장중은 최근 스냅숏, 휴장·정산 대기는 최신 값(그 거래일 정산가가 있으면 정산가, 없으면 마지막 스냅숏)이다. `asOf`는 그 값의 시각이다(D-048).
- `nextUpdateAt`(D-048, 계산은 `calc/marketState.ts`, D-062)
  - 장중: 다음 장중 배치 완료 예상 시각
  - 장 마감 뒤 그 거래일 정산 전·정산 대기: 일일 정산 ① 뒤 첫 장중 배치 완료 예상 시각(보통 19:00 CT 배치 뒤). 다시 조회했을 때 아직 대기면 서버가 다음 주기로 미룬 값을 준다.
  - 그 밖의 휴장(주말·휴장일): 다음 개장 뒤 첫 장중 배치 완료 예상 시각
- 앱은 화면이 보이는 동안 `nextUpdateAt` + 여유 1분에 해당 query를 다시 조회한다(D-030 후속). `null`이면 자동 새로고침하지 않고 당겨서 새로고침과 앱 복귀 재조회만 한다.

### 앱 fetch 래퍼와 AppError
- `src/api`의 래퍼가 인증 헤더, 타임아웃(15초), JSON 파싱, shared 스키마로 봉투·`data` 검증(`zod` parse)을 맡고, 실패는 모두 `AppError`로 던진다.
- 래퍼는 `apiRequest(path, schema, { method, query, body, auth, signal })` 하나다(`src/api/client.ts`). 엔드포인트 함수(`src/api/health.ts` 등)가 이것을 부르고, query key는 `src/api/queryKeys.ts`, query client는 `src/api/queryClient.ts`에 둔다(D-072).
  - 접근 키는 `src/api/accessToken.ts` `getAccessToken()`에서만 읽는다. 앱 시작 때 SecureStore에서 한 번 읽은 메모리 값이고, 없으면 dev 변형만 `DEV_API_TOKEN`이다(D-077). 키가 없으면 요청하지 않고 `UNAUTHORIZED`를 던진다. B-b의 키 확인은 `token` 옵션으로 저장 전 키를 보낸다.
  - 타임아웃은 내부 `AbortController` + `setTimeout`으로 만들고 호출자 `signal`(TanStack Query 취소)을 연결한다. 호출자 취소는 `AppError`로 바꾸지 않고 그대로 던진다.
  - 봉투가 아닌 응답(프록시 502 HTML 등)은 HTTP 5xx면 `INTERNAL`(재시도), 그 밖은 `SCHEMA_MISMATCH`다. 모르는 에러 `code`도 `SCHEMA_MISMATCH`다.
- `AppError`는 `code`(서버 코드 + 앱 코드 `NETWORK`·`TIMEOUT`·`SCHEMA_MISMATCH`), `status?`(HTTP), `cause?`를 가진다. 화면은 `code`만 보고 문구를 고른다.
- 재시도(TanStack Query `retry`): `NETWORK`·`TIMEOUT`·`INTERNAL`만 최대 2회. 4xx와 `SCHEMA_MISMATCH`는 재시도하지 않는다. mutation은 자동 재시도하지 않는다.
- 화면 표시: 처음 로딩 실패는 오류 화면 + [다시 시도]. 이미 데이터가 있는 상태의 새로고침 실패는 기존 데이터를 유지하고 기준 시각 줄로 오래됨을 알린다(product.md 배치 실패 시).
- `UNAUTHORIZED`: 앱은 접근 키 입력 화면(B-b)으로 보내고 "키가 맞지 않습니다"를 보여 준다. 저장된 키는 새 키를 확인할 때까지 지우지 않는다. `RATE_LIMITED`는 잠시 뒤 다시 시도하라는 오류 화면이다(D-044).

### 엔드포인트 초안
개발 단계에서 응답 필드를 정하면서 고친다.

- 차트 시계열(C-a 지수 일봉, C-c 월물 원가격)은 화면에 들어갈 때 전체를 한 번에 받는다. 핀치·드래그는 받은 데이터 안에서만 처리하고 추가 요청을 하지 않는다. C-a 봉 4,000개는 JSON 약 400KB, Caddy 압축(`encode zstd gzip`) 뒤 약 100KB다. 파싱·렌더링이 느리면 C-a 스파이크(D-032)에서 행 객체 대신 열 배열(`{ dates: [], open: [], … }`)로 바꾼다(D-046).
- 커브는 캐시하지 않는다(D-046). 기준일 하나에 월물 약 30개 × 20거래일을 읽는다.

| 메서드·경로 | 화면 | 내용 |
|---|---|---|
| `GET /v1/health` | — | 인증 없음, 배포 확인용. DB `select 1`(3초 제한) 실패 시 500 `INTERNAL`(D-059) |
| `GET /v1/commodities` | A | 원자재별 월물 5개 시세, 대표월물, 알림 표시, freshness. 스키마는 shared `commodities.ts`, 표시 값 규칙은 `calc/quotes.ts`(D-085) |
| `GET /v1/commodities/:code/disparity?basis&ma&window&levels` | C-a | 지수 일봉(맞춤 비율 곱함)·이평선·보유 월물·롤 구간, 오늘 잠정 봉, rare 레벨 10개, 꼬리 백분위, 대체 여부, freshness. 스키마는 shared `disparity.ts`, 조립은 `calc/disparityChart.ts`(D-086) |
| `GET /v1/commodities/:code/curve?baseDate` | C-b | 기준일·현재 커브, 스프레드·롤 수익률, freshness |
| `GET /v1/commodities/:code/contracts` | C-c | 월물 5개 원가격 시계열, freshness |
| `GET /v1/commodities/:code/etps` | C-d | ETP 목록(필터·정렬은 앱에서) |
| `GET /v1/etps/:id` | C-d-a | ETP 상세 |
| `GET /v1/settings`, `PATCH /v1/settings` | B, B-a, 앱 실행 | 이격도차트·알림 설정, 언어·시간대(푸시 문구·거부 시간용). 앱 실행 때 시간대가 바뀌었으면 PATCH(D-048). 스키마는 shared `settings.ts`, PATCH는 바꿀 필드만 보내고 전체 설정을 받는다(D-081) |
| `PUT /v1/devices` | 앱 실행 | 푸시 토큰·플랫폼·앱 버전 upsert(`pushToken` 기준). 토큰을 못 받으면 부르지 않는다(D-048) |

## 환경 설정 분리 (dev / prod)

D-043. dev는 로컬 Mac, prod는 Oracle VM 하나다. 별도 staging은 두지 않는다.

| 구분 | dev | prod |
|---|---|---|
| 서버 실행 | Mac에서 Node 직접 실행(`npm run dev -w apps/server`) | VM Docker Compose(D-034) |
| DB | Mac 로컬 Postgres 18(Homebrew `postgresql@18`, DB `futureetp`) | Compose의 `postgres:18` 컨테이너 |
| 서버 주소 | 에뮬레이터 `http://10.0.2.2:<port>`, iOS 시뮬레이터 `http://localhost:<port>`, 실기기 같은 Wi-Fi의 Mac LAN IP | `https://<도메인>`(Caddy, D-036) |
| 배치 스케줄러 | 꺼짐(`SCHEDULER_ENABLED=false`). 작업 하나를 CLI로 1회 실행 | 켜짐 |
| 데이터 | prod 덤프 복원(prod 가동 전에는 적재 스크립트로 직접) | 배치·적재 스크립트 |
| 앱 | dev 변형(개발 빌드 + Metro) | prod 변형(release APK + EAS Update) |
| 푸시 | dev DB에 등록된 dev 기기에만 | prod 기기 |

### 서버 환경 변수
- `process.env`는 `apps/server/src/config.ts`에서만 읽는다. 시작할 때 zod로 검증하고, 빠지거나 틀린 값이 있으면 바로 종료한다. 다른 모듈은 검증된 `config` 객체를 import한다.
- 항목(D-053, 예시는 `apps/server/.env.example`): 필수 `NODE_ENV`(`development`·`production`), `DATABASE_URL`, `API_TOKEN`(32자 이상, D-036), `SCHEDULER_ENABLED`. 기본값 있음 `PORT`(3000), `LOG_LEVEL`(info). 비워도 시작 `DATABENTO_API_KEY`·`MASSIVE_API_KEY`·`KRX_API_KEY`·`FCM_SERVICE_ACCOUNT_PATH`·`HEALTHCHECKS_PING_KEY`(dev는 비움, D-045)·`BACKUP_DIR`. 비워도 시작하는 값은 그 값을 쓰는 작업이 실행될 때 없으면 그 작업이 실패한다. 값이 dev와 prod에서 달라지는 것은 모두 환경 변수로 받고, 코드에서 `NODE_ENV`로 분기하지 않는다(로그 형식 같은 개발 편의만 예외).
- dev: `apps/server/.env`(커밋 안 함)를 Node 내장 `--env-file`로 읽는다. 저장소에는 키 이름과 예시 값만 담은 `apps/server/.env.example`을 둔다.
- prod: VM의 `infra/.env`(권한 600)를 Compose `env_file`로 넘긴다. 이 파일과 서비스 계정 키는 저장소에 넣지 않고, 배포 스크립트의 rsync에서도 제외해 VM에서 직접 관리한다. 서비스 계정 키는 컨테이너에 읽기 전용으로 마운트한다.
- 외부 소스 키는 dev와 prod가 같은 키를 쓴다(Massive Basic 분당 5회 등 한도가 키 단위). 그래서 dev는 스케줄러를 끄고, 수동 실행도 필요한 작업만 한다. 테스트는 녹화한 응답(fixture)과 가짜 `sources`를 쓰고 실제 소스를 호출하지 않는다(D-038).

### 배치 수동 실행
- `jobs/`의 작업은 스케줄러와 CLI가 같은 함수(`runJob`)를 부른다. `npm run job -w apps/server -- <작업 이름> [기준 시각]`이 그 작업을 1회 실행(재시도 없음)하고 `batch_run`에 기록한 뒤 종료한다. 실패하면 종료 코드 1이다. 작업 이름은 스케줄러 등록 이름과 같다.
- 시각 의존 작업(정산 대기·휴장 판정)은 CLI의 기준 시각(오프셋이 있는 ISO, 예: `2026-10-27T18:30:00-05:00`)을 `ctx.now`로 받는다(`calc`가 현재 시각을 인자로 받는 규칙, D-041).
- 스케줄 실행은 실패 시 작업별 간격 뒤 1회 재시도하고, 시도마다 `batch_run` 행을 만든다. 일정·재시도 간격·같은 시각 작업 순서는 `jobs/scheduler.ts`의 `TRIGGERS`·`RETRY_DELAY_MS`(D-060).

### dev 데이터 복원
- `scripts/`의 복원 스크립트가 VM에서 `pg_dump`(custom 형식)를 받아 로컬 dev DB에 `pg_restore`한다. 받은 덤프 파일은 VM 밖 보관 사본도 겸한다(D-034 백업 후속).
- 복원 직후 `device`(prod 기기 푸시 토큰)와 보류 알림을 비운다. dev 서버가 prod 기기로 푸시를 보내지 않게 하기 위해서다.
- 복원은 수동으로 필요할 때만 한다. 스키마가 덤프보다 앞서 있으면 복원 뒤 Drizzle 마이그레이션을 적용한다.

### prod 배포(D-048)
- `scripts/`의 배포 스크립트가 ① rsync(`infra/.env`·키 파일 제외) ② VM에서 이미지 빌드 ③ `pg_dump` 덤프 ④ 새 이미지의 일회성 컨테이너로 Drizzle 마이그레이션 ⑤ `docker compose up -d`로 서버 교체 순서로 진행한다. ④가 실패하면 ⑤를 하지 않고 이전 서버를 그대로 둔다.
- 서버는 시작할 때 마이그레이션하지 않는다. 문제가 생기면 ③ 덤프로 복원한다. 컬럼 삭제처럼 되돌리기 어려운 변경은 "추가 → 코드 배포 → 삭제" 두 번의 배포로 나눈다.
- 마이그레이션 SQL은 dev에서 `npm run db:generate -w apps/server`(drizzle-kit)로 만들어 `apps/server/drizzle/`에 커밋한다. 적용은 `src/db/migrate.ts`(코드 `migrate()`)이고 dev는 `npm run db:migrate -w apps/server`, prod는 ④의 일회성 컨테이너에서 `node src/db/migrate.ts`다. prod 이미지에는 drizzle-kit을 넣지 않는다(D-053).

### 앱 변형(app variant)
- `apps/mobile/app.config.ts`가 `APP_VARIANT`(`development`·`production`, 기본 `production`)로 설정을 바꾼다. Expo 공식 app variant 방식(https://docs.expo.dev/build-reference/variants/).

| 항목 | development | production |
|---|---|---|
| 앱 이름 | `futureETP Dev` | `futureETP` |
| Android package / iOS bundle ID | `io.github.seyoon.futureetp.dev` | `io.github.seyoon.futureetp` |
| scheme | `futureetp-dev` | `futureetp` |
| 아이콘 | 구분 표시가 있는 아이콘(아이콘 제작 때, 지금은 기본과 같음) | 기본 |
| 서버 주소 | `DEV_API_URL`(`apps/mobile/.env.local`, 없으면 에뮬레이터 주소:3000) | prod 도메인(app config에 커밋, 확정 전 `futureetp.invalid`) |
| HTTP | 평문 HTTP 허용(Android debug 매니페스트, iOS ATS 로컬 네트워크) | HTTPS만(release는 평문 차단) |
| EAS Update | 받지 않음(Metro로 개발) | 채널 `production` |

- 서버 주소는 비밀 값이 아니므로 app config `extra`에 넣고 앱은 `expo-constants`로 읽는다. 읽는 곳은 `src/api`의 설정 모듈 하나다. prod 접근 키는 여기에 넣지 않는다(EAS Update 번들 노출, D-039). 키는 B-b에서 입력한다(D-044).
- dev 변형만 `.env.local`의 `DEV_API_TOKEN`을 `extra`에 넣어 키 입력을 건너뛸 수 있다. dev 변형은 EAS Update를 발행하지 않고, prod 변형 config에는 이 값을 넣지 않는다.
- 같은 기기에 두 변형을 함께 설치한다. 평소 쓰는 release 앱은 개발 빌드를 설치해도 지워지지 않는다.
- 앱 `package.json` 스크립트가 변형을 고정한다(D-052): `start`(dev Metro), `android:dev`·`ios:dev`, `android:release`, `update:prod`. 빌드 스크립트는 매번 해당 변형으로 `expo prebuild --clean` 한 뒤 빌드한다(CNG, D-027). 변형 없이 `expo` 명령을 직접 쓰면 production으로 평가된다.
- 앱에서 `extra`를 읽는 곳은 `src/api/config.ts` 하나다.
- EAS Update는 `npm run update:prod`(`eas update --channel production --environment production`)로 발행한다. `--environment`를 주면 eas-cli가 로컬 `.env`를 읽지 않으므로(`EXPO_NO_DOTENV=1`) dev 값이 섞이지 않는다. prod config는 환경 변수를 쓰지 않아 EAS 환경에 둘 변수도 없다(D-052).
- 푸시: Firebase 프로젝트 하나에 두 package의 Android 앱을 함께 등록한다. 내려받은 `google-services.json` 하나에 두 앱 정보가 모두 들어가므로 서버 서비스 계정 키도 하나로 dev·prod 양쪽에 보낸다.

## 운영 (접근 키·실패 알림·백업·보관)

### 서버 접근 키(D-044)
- 키는 32바이트 난수를 base64url로 인코딩한 문자열이다. `scripts/access-key.mjs`(`npm run access-key`)가 만들고, QR(`futureetp-key:v1:<키>`)을 터미널에 띄운다. 기존 키는 `--show`에 stdin으로 넘겨 QR만 다시 띄운다(D-080).
- 앱: 처음 실행할 때 키가 없으면 B-b(접근 키 입력)를 먼저 띄운다. 카메라로 QR을 읽고, 카메라를 쓸 수 없으면(iOS 시뮬레이터, 권한 거부) 붙여넣기로 넣는다. 접두사 형식이 아니면 거절한다. 입력한 키로 `GET /v1/settings`를 불러 성공하면 `expo-secure-store`에 저장하고, 그 뒤에 기기 등록(`PUT /v1/devices`)을 한다.
- `src/api` 래퍼가 SecureStore의 키를 읽어 헤더에 붙인다. 키를 메모리에 한 번 읽어 두고, 바꾸면 갱신한다. TanStack Query 캐시(`QueryCache`·`MutationCache`)의 `onError`에서 `UNAUTHORIZED`면 접근 키 store에 거절 표시를 하고, 루트 레이아웃이 보고 B-b로 보낸다. B-b의 새 키 확인 mutation(`meta.checksNewKey`)은 빼고, 거절 표시는 새 키 저장이나 B-b를 떠날 때 지운다(D-079).
- 교체: ① 키 스크립트로 새 키 생성 → ② VM `infra/.env`의 `API_TOKEN` 수정 → ③ `docker compose up -d`로 서버 재시작 → ④ 각 기기가 401을 받아 B-b로 가면 새 QR을 읽는다. 사용자 1명이라 키는 하나만 받는다(교체 중 두 키를 함께 받는 기간을 두지 않음).
- 키는 저장소와 앱 번들에 넣지 않는다. VM `infra/.env`가 원본이고, 비밀번호 관리자에 사본을 둔다.

### 운영자 실패 알림(D-045)
- 앱 푸시: 배치가 재시도까지 실패하면(`batch_run` 최종 `FAILED`) 등록된 모든 기기로 운영 알림을 보낸다. 소스 응답 형식 검증 실패도 그 배치의 실패로 처리한다. 같은 작업은 실패한 뒤 성공하기 전까지 CME 거래일당 1회만 보낸다(장중 15분 배치가 계속 실패해도 반복하지 않음). 보낸 시각은 그 실행의 `batch_run.ops_notified_at`에 남기고, 같은 작업의 마지막 성공 뒤 같은 거래일에 이 값이 있는 실행이 있으면 보내지 않는다(D-048).
- 운영 알림은 B-a 알림 설정(원자재 선택·거부 시간)을 따르지 않고 바로 보낸다. Android 알림 채널을 시세 알림과 나눠(`ops`), 시끄러우면 OS 설정에서 이 채널만 끌 수 있게 한다. 문구는 shared 푸시 문구 리소스에 둔다.
- Healthchecks.io(무료 플랜 20개): 서버 중단·VM 회수처럼 스스로 푸시를 보낼 수 없는 경우를 잡는다. 스케줄 작업마다 check를 하나씩 두고 일정(cron 식·시간대)을 작업과 같게 맞춘다. 작업은 시작 때 `/start`, 끝날 때 성공 또는 `/fail`을 보낸다. URL은 프로젝트 ping key와 작업 이름 slug로 만든다(`https://hc-ping.com/<HEALTHCHECKS_PING_KEY>/<작업 이름>`, D-053). 휴장이라 할 일이 없을 때도 성공 신호를 보낸다. 신호가 일정보다 늦으면 Healthchecks.io가 메일을 보낸다.
- dev는 ping URL을 비워 신호를 보내지 않는다. ping 실패는 배치 결과에 영향을 주지 않는다(로그만 남김).

### 백업(D-045)
- `BACKUP` 작업(croner, 매일 1회)이 서버 컨테이너에서 `pg_dump -Fc`로 덤프를 만든다. VM의 백업 볼륨에 최근 7개만 둔다. 서버 이미지에 Postgres와 같은 major 버전의 클라이언트를 넣는다.
- Mac: `scripts/`의 백업 내려받기 스크립트가 최신 덤프를 저장소 밖 폴더로 받는다(주 1회 목표, 최근 8개 보관). 받을 때 Healthchecks.io의 내려받기 check(주기 7일 + 여유 2일)에 신호를 보내, 오래 받지 않으면 메일이 온다. dev 복원(D-043)은 이 폴더의 최신 덤프를 쓴다.
- 일봉 원천은 소스에서 다시 받을 수 있고, 설정은 작아서 며칠치 손실은 감수한다. 서명 키(keystore)·`infra/.env`·서비스 계정 키는 DB 백업과 별도로 저장소 밖에 둔다(D-039).

### 데이터 보관(D-046)
- `BACKUP` 작업이 덤프 뒤에 오래된 행을 지운다(지우기 전 덤프가 있어야 하므로 이 순서).

| 테이블 | 보관 |
|---|---|
| `intraday_snapshot`, `index_snapshot` | 90일 |
| `alert_record`, `batch_run` | 1년(중복 방지·정산 대기 판단에는 최근 기록만 필요) |
| `daily_bar`, `index_bar`, `disparity` 등 일봉·계산 결과 | 영구(data-model) |

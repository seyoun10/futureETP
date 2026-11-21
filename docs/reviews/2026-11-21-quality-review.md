# 전체 코드 품질 검증 보고서 (2026-11-21)

기준 커밋 `62ecbd7`. 방법: 기준선 `npm run check` → 영역별 1차 리뷰(5개) → 각 발견을 다른 agent가 반박 목표로 교차 검증(재현 포함) → Stryker 10.1.1 변이 검사(임시 worktree, 저장소 무변경).

## 1. 요약

| 영역 | CONFIRMED | PLAUSIBLE | REJECTED | 최고 심각도 |
|---|---|---|---|---|
| A 서버 calc | 2 | 0 | 0 | minor |
| B 서버 api·db | 3 | 1 | 0 | minor(상단) |
| C 서버 jobs·sources | 3 | 1 | 0(C3 일부 반박) | **important** |
| D shared·계약 | 1 | 1 | 1 | nit |
| E 모바일 | 5 | 0 | 0(E1 원인 설명 정정) | moderate |

- 기준선: `npm run check` 전 단계 통과(서버 테스트 846개, DB 통합 테스트 포함). 커버리지 lines 서버 85% · shared 99% · 앱 73%.
- 변이 점수: 서버(calc+api) **90.5%**, shared **89.1%**, 앱(charts·lib 순수 로직) **65.2%**.
- 결론: 계산(calc)·계약은 탄탄함. 실제로 손볼 가치가 큰 것은 **C1, C2, E1, B1** 4건.

## 2. 우선 수정 후보 (교차 검증 후 심각도)

### C1 — important · 장중 배치가 휴장 전날 저녁 세션을 놓침
- `apps/server/src/jobs/intraday.ts:99` 달력을 UTC 오늘+1일까지만 읽음. `calc/tradingCalendar.ts:130-132`는 정지일 다음 거래일 세션을 정지일 전날 17:00 CT에 열기 때문에 거래일이 +2일 이상일 수 있음. API(`api/market.ts:23`)는 +10일.
- 재현(실제 2026·2027 달력, 15분 슬롯 비교): 2026-06-18 22:00Z~06-19 18:15Z **82슬롯(약 20.5시간)**, 07-02~07-03 82슬롯, 월요일 공휴일 전 일요일 저녁 4~8슬롯, **추수감사절 전날 2026-11-25 23:00~23:45Z 4슬롯**. 이 동안 API는 OPEN, 배치는 CLOSED로 skip → 스냅숏·rare 알림 판정 없음.
- 수정: lookahead를 API와 같은 상수로 공유. 회귀 테스트: 정지일 전날 저녁 슬롯.

### C2 — important(실사용 영향 중간) · 실패한 지연 발송이 같은 슬롯에서 즉시 재발송돼 FAILED (D-023 위반)
- `jobs/scheduler.ts:28`(:00/:30에 DEFERRED_PUSH → INTRADAY), `jobs/rareAlert.ts:306`(RETRY 전환 시 detectedAt 유지), `jobs/intraday.ts:84-86`, `db/rareAlertStore.ts:63-64`(`detected_at < before`만 조건).
- 재현(실제 핸들러 + 실패 sender): HELD→RETRY→약 6초 뒤 RETRY→FAILED, 발송 2회. "다음 주기 1회 재시도"가 사라짐.
- 수정: 재시도 기준을 RETRY로 바뀐 시각으로 두거나, :00/:30에서는 INTRADAY의 retry 생략.

### E1 — moderate · 데이터 배열이 바뀌면 십자선·상세 박스가 엉뚱한 봉을 가리킴
- 원인(교차 검증에서 정정): victory-native 42.0.1은 `data`가 바뀌면 press 상태를 리셋(`CartesianChart.tsx:646-660`)하지만, 훅의 `crosshairVisible`(`useChartViewport.ts:227`)과 `detail`(`:78`, `onSnap` `:327-346`)은 리셋되지 않음.
- 증상: 과거 3년 페이지가 붙거나 자동 새로고침으로 배열이 바뀌면 십자선이 좌상단으로 튀고 날짜 라벨은 빈 값, 가격 라벨은 옛 값, 상세 박스는 약 756봉 앞의 다른 봉 숫자(`CandleChart.tsx:266-272`, `LinesChart.tsx:215-221`). 십자선 상태에서도 핀치는 막지 않아(`:287`, `:302`) 도달 가능.
- 수정: `data`/`bars`가 바뀌면 십자선·detail을 지우거나 새 순번으로 재매핑. 변이 점수 6%인 `useChartViewport.ts` 테스트 보강과 함께.

### B1/C3 — minor(상단) · pg 풀 `error` 리스너 없음 → DB 연결 끊김 시 프로세스 종료
- `apps/server/src/db/client.ts:11-19`. 재현: `pg_terminate_backend`로 유휴 연결을 끊자 `Unhandled 'error' event`(57P01), 종료 코드 1.
- 영향: Docker `restart: unless-stopped`로 복구되나 진행 중 배치를 잃음. 재시작 시 `failInterrupted`(`jobs/batchRunStore.ts:20-27`)는 FAILED로 닫기만 하므로 정산 도중이면 다음 평일 16:05 CT까지 정산 대기(금요일이면 월요일까지). Healthchecks.io 메일은 옴(C3의 "알림 없음" 주장은 반박됨).
- 수정: `db.$client.on('error', log)` 한 줄.

## 3. 그 밖의 확인된 결함

| ID | 판정 · 심각도 | 위치 | 내용 |
|---|---|---|---|
| A1 | CONFIRMED · minor | `apps/server/src/calc/curve.ts:85` | M2 면제를 위치로만 판정. M2 자리 월물이 거래량은 충분한데 그날 값만 없고 다음 월물이 미달이면 m2=null → 커브 요약 "산출 불가". 같은 파일 `:53`·`:94`의 M2 정의와 불일치. D-068에도 이 경우가 없음 → 문서 한 줄 먼저 |
| A2 | CONFIRMED · low | `apps/server/src/calc/quotes.ts:76` | 직전 정산가 ≤0이면 changePct 부호 반대/Infinity(JSON null). `compareCurves`의 `basePrice > 0` 규칙과 불일치. 홈 경로에선 재발 가능성 매우 낮음 |
| E2 | CONFIRMED · minor | `apps/mobile/src/api/useSettings.ts:51-54` | PATCH 뒤 시작된 GET(마운트 재조회)의 늦은 응답이 새 값을 옛 값으로 덮음(query-core 5.105.0로 재현) |
| E4 | CONFIRMED · minor | `apps/mobile/src/push/PushRegistration.tsx:21-23` | 등록 시도 전에 `registered=true` → 401 뒤 새 키를 저장해도 콜드 스타트까지 재등록 안 함 |
| E3 | CONFIRMED · low | `useSettings.ts:51` | 첫 조회 중 PATCH 실패 시 설정 query가 pending/idle로 고착(C-a가 스택에 있을 때만, 포커스로 풀림) |
| E5 | CONFIRMED · low | `apps/mobile/src/api/useAutoRefresh.ts:33` | 자동 새로고침 `refetch()`(cancelRefetch 기본 true)가 진행 중 과거 받기를 조용히 취소 |
| B2/D1 | CONFIRMED(서버) · nit | `packages/shared/src/settings.ts:36,42` | rare 레벨 중복 검사가 반올림 전 값 기준 → API 직접 호출로 `[1,1.00000000001,…]` 저장 시 C-a가 400 고착. 앱은 `RareLevelsInput.tsx:82` `maxLength={4}`로 입력 불가(1~4자 전수 대입 0건) |
| B3 | CONFIRMED · nit | `apps/server/src/db/recompute.ts:78-118` | 재계산 DELETE→INSERT에 잠금 없음. CLI와 배치가 겹치면 23505(재현). prod에서 CLI 수동 실행 절차가 없어 nit |
| B4 | PLAUSIBLE · nit | `apps/server/src/api/disparity.ts:71-78` (curve·contracts도 같은 패턴) | 여러 조회가 공통 스냅숏 없이 읽혀 재계산 커밋 순간 세대 혼합 가능(수 ms, 다음 조회 회복) |
| C4 | PLAUSIBLE · nit | `apps/server/src/jobs/scheduler.ts:118-120` | croner `catch` 옵션 없음. 현재는 runner가 모두 삼켜 실제로 터지지 않음 |
| D3 | CONFIRMED · nit | `packages/shared/src/queries.ts:22` | levels query가 `" 1, 2,4 ,0x8,1e1"`을 통과. 앱 영향 없음, 형제 앱 계약 엄격성 문제 |

반박된 항목: D2(timezone이 IANA 외 값도 받음) — 서버가 같은 `Intl`로 일관 처리하고 D-081도 `Intl` 수용 여부로 정의해 오동작 없음.

## 4. 테스트 품질 (변이 검사)

| 대상 | 점수 | 약한 곳(생존/미도달 변이) |
|---|---|---|
| 서버 calc | 대부분 90%+ | `rollWeight.ts` 생존 26, `curve.ts` 91.9%(237/258, 정정 아래) |
| 서버 api | 86.2%(395/458, 재측정 아래) | 초판 50~100%. 남은 약한 곳: `settings.ts` 60%·`devices.ts` 67%(라우트 경로 등가), `params.ts` 77%(JSON 아닌 body catch, ETP id 검증), `app.ts` 81%(`HTTPException` 4xx 분기 미도달), `disparity.ts` 83%(`rule` null 분기) |
| shared | 89% | `contracts.ts:33` prices/dates 길이 refine 미실행(50%), `push.ts` 영어 문구 단수/복수·`+0.0%` 경계, `settings.ts:36` `<`↔`<=`, `devices.ts:14` trim |
| 앱 charts·lib | 65% | **`useChartViewport.ts` 6%(생존 96, 미도달 140)**, `chartText.ts` 0%(Skia), `lineSampling.ts` 73%(빈 입력·px≤0·hi<lo 가드), `curveLayout.ts` 80%(눈금 단계 경계·라벨 충돌 회피), `formatNumber.ts` 78% |

**정정 (2026-11-21, `75f6d85`에서 Stryker 10.1.1 재측정)**: 초판의 "`calc/curve.ts:130` `basePrice > 0` 가드 제거가 생존(테스트 미고정)"은 사실과 다르다. 가드(현재 `:133`)는 보고서 기준 커밋 전부터 `curve.test.ts`의 "기준일 가격이 0 이하이면 변화율은 null이다"로 고정돼 있고, `> 0` 제거·`<=`·`>=` 변이 모두 killed다. 같은 줄에서 산 1건은 `p.basePrice !== null`→`true`인데, null이면 `p.basePrice > 0`도 거짓이라 결과가 같은 등가 변이다. `calc/curve.ts` 점수는 91.9%(237/258)이고, 남은 생존은 `:84` M2 면제·`:190` 기준일 상한·`:270` 스냅숏 표시 등이다(`:190`의 등가 변이는 `8b23c1e`에서 상한 비교를 없애 사라졌다).

**후속 (api 테스트 보강)**: `api/curve.ts` 66.7% → 93.0%(53/57), `clientIp.ts` 50.0% → 93.8%(15/16). 남은 생존 5건(`curve.ts:48`·`:68`의 null 검사 제거와 `<`↔`<=`, `:71` 빈 배열, `clientIp.ts:9` `?.` 제거)은 모두 등가 변이다. `settings.ts` 60%(3/5)의 생존 2건은 라우트 경로 `'/'`→`''`로, Hono에서 `/v1/settings`·`/v1/settings/` 응답이 같아 등가다(테스트 추가 없음).

**후속 2 (수동 변이 확인)**: `calc/curve.ts:84`의 `i === m1Index`→`true`는 M1 앞 월물만으로 12개가 차는 경우(원본 m1=null)에 달라져 테스트를 넣었다. 같은 줄 `hasPrice(c)`→`true`(m1Index가 있으면 그 월물은 늘 값이 있음)와 `:190`의 `requested > maxBaseDate` 변이(뒤로 넘친 요청도 `findLastIndex`가 마지막 날을 고름)는 등가다. `api/commodities.ts:76` asOf 최댓값 선택(원자재 순서 양방향)과 `app.ts`의 `clearTimeout`·기본 DB 확인 시간(3초)·기본 인증 실패 한도(15분 10회)를 테스트로 고정했다. `commodities.ts:76`의 `result.asOf &&` 제거는 null 비교가 거짓이라 등가다.

**후속 3 (서버 api 재측정, `8b23c1e`, Stryker 10.1.1, `src/api` 테스트만 실행)**: 전체 86.2%(killed 395, survived 53, 미도달 10). 파일별 `response.ts` 100, `chartPage.ts` 95.5, `clientIp.ts` 93.8, `curve.ts` 93.0, `contracts.ts` 89.3, `auth.ts` 88.7, `deviceId.ts` 87.5, `etps.ts` 86.4, `commodities.ts` 84.9, `disparity.ts` 82.9, `app.ts` 81.5, `market.ts` 81.5, `params.ts` 77.3, `devices.ts` 66.7, `settings.ts` 60.0, `errors.ts` 50.0. 생존의 약 절반은 오류 메시지·라우트 경로 문자열(테스트가 `code`만 확인)과 `?.` 제거 같은 등가 변이다. 테스트로 고정할 만한 곳: `app.ts:59` Hono `HTTPException`(4xx)→`VALIDATION_FAILED` 분기 미도달, `params.ts:35` JSON 아닌 body의 catch(5절 공백과 같음), `params.ts:20` 잘못된 ETP id, `disparity.ts:66`·`:88` 롤 규칙 basis의 `rule` 응답, `etps.ts:43` seriesCode 정렬, `auth.ts:21` 인증 성공 시 실패 기록 삭제·`:34` 정리 주기·`:64` 정규식 앵커, `chartPage.ts:11` `before` 없음 분기.

**후속 4 (api 테스트 보강)**: 후속 3에서 고를 만하다고 적은 곳을 테스트로 고정했고, 수동 변이 8개가 모두 killed다(`app.ts:59` 4xx·5xx 분기, `params.ts` `jsonBody` catch·`etpIdParam` 검증, `disparity.ts:66`·`:88` 잠정 봉 롤 기간, `etps.ts:43` 정렬, `auth.ts:21` 지난 항목 삭제·`:64` `^` 앵커). `chartPage.ts:11`(`before`가 없으면 `findIndex`도 -1), `auth.ts:64`의 `$` 제거(`.+`가 끝까지 먹고 헤더에 줄바꿈이 없음), `auth.ts:34` 정리 주기(`size()`로만 보이는 성능 선택)는 등가이거나 고정할 가치가 없어 두었다.

**후속 5 (앱 재측정, `afe5930`, Stryker 10.1.1 + jest-runner, `src/charts/**/*.ts`·`src/lib/**/*.ts`)**: 전체 65.2% → **72.2%**(killed 907, timeout 31, survived 227, 미도달 135). `useChartViewport.ts` 6% → **85.4%**(E1 수정·테스트 보강 `e38405b`·`89b990c`). 그 밖에 `viewportChange.ts` 94.5, `priceLabels.ts` 94.3, `extremeTagLayout.ts` 90.7, `failedAlert.ts` 90.9, `fitTransform.ts` 84.5, `curveLayout.ts` 80.2, `useOlderPages.ts` 79.6, `formatNumber.ts` 75.0, `lineSampling.ts` 73.0, `formatAmount.ts` 62.8. 점수를 끌어내리는 `chartText.ts`(Skia)·`useGestureFps.ts`·`perfLog.ts`(측정용)·`orientation.ts`는 0~22%로, 테스트할 순수 로직이 거의 없다.

**후속 6 (검증 뒤 새로 쓰거나 고친 앱 로직, 같은 도구, 따로 측정)**: 62.1%(killed 51, timeout 3, survived 30, 미도달 3). `monthGrid.ts` 78.4, `useSettings.ts` 53.1(E2 수정 경로: `:33` 대기 중 변경 병합 조건, `:49` mutation scope, `:51`·`:54` `cancelQueries`가 생존), `useMarketCalendar.ts` 50.0, `api/calendar.ts` 0(테스트 없음). 위 후속 5의 분모와 섞지 않는다. 이어서 `useSettings.ts` 생존·미도달 변이를 테스트로 고정했다(첫 조회 전 변경, PATCH 직렬화, 설정 조회만 끊기, 알림 원자재 변경 시 목록만 무효화). 수동 변이 11개 중 10개 killed, 남은 `scope.id` `''`는 scope를 쓰는 mutation이 하나뿐이라 등가다.

**후속 7 (E3 수정·calendar 테스트)**: E3는 PATCH 실패(`onError`) 시 설정을 무효화해 다시 조회하도록 고쳤다(재조회를 기다리지 않아 실패한 변경이 바로 빠지고 다음 PATCH도 밀리지 않음). 회귀 테스트 "첫 조회 중 보낸 PATCH가 실패하면 설정을 다시 조회한다"는 수정 전 실패를 확인했다. `api/calendar.ts`는 요청 경로·스키마·`signal` 전달을 고정하는 테스트를 넣었다.

리뷰 발견과 겹치는 곳(우선순위 상향): `useChartViewport.ts`(E1), `useOlderPages.ts` 80%(E5), `settings.ts:36`(B2/D1), `clientIp.ts`(B 테스트 공백), `contracts.ts:33`(D 테스트 공백).

## 5. 테스트 공백 (리뷰어 보고 요약)

- 서버: C1 정지일 전날 저녁 슬롯, C2 지연 발송 실패 뒤 같은 슬롯 재시도, `batchRunStore` DB 테스트, `startScheduler`(failInterrupted·트리거 throw), `createDisparityStore`·`createCurveStore`·`createContractsStore` DB 테스트 없음(라우트 테스트는 가짜 store), `params.ts` JSON 아닌 body, BCBCLI 9월·12월·첫날 롤 중간, 서머타임 시작 주.
- shared: 응답 스키마 `settingsSchema`·`deviceSchema`·`healthSchema`를 서버 테스트가 parse하지 않음, `deviceRegistrationSchema` 단위 테스트 없음, 계약 `ERROR_HTTP_STATUS`와 서버 `ERROR_STATUS` 중복 정의(비교 테스트 없음 → shared에서 import해 일원화 권장).
- 앱: E1~E5 각 경로, `useChartPeriodView`·`ChartBusy`·축 레이어의 봉 1개 경계, `PushRegistration` 재등록.

## 6. 확인했고 문제없던 범위 (요약)

calc 순수 함수 원칙(D-041/D-046), 거래일·세션 경계, 롤 비중·지수 체인·이격도 백분위, 응답 봉투·에러 code·HTTP 상태, 인증 토큰 비교(timingSafeEqual), XFF 위조 불가 구성, 마이그레이션 journal, shared 스키마와 서버 응답 형태, 커밋된 contract drift 없음, ko/en i18n 키 208개 일치, 토큰 로그 비노출.

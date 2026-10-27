# 데이터 모델 초안

> TODO 1단계 Step 2 산출물. 서버 DB의 논리 모델이다. DB는 PostgreSQL(D-035)이고, 물리 타입은 `apps/server/src/db/schema.ts`가 기준이다(D-058: enum은 text, 가격은 numeric, 분포 배열만 double precision[]).
> 계산 규칙은 [`product.md`](product.md)가 기준이고, 여기서는 그 규칙을 담을 테이블만 정의한다. 결정 근거는 `decisions.md` D-010.

## 공통 규약
- 시각(`*_at`)은 UTC timestamp로 저장한다. 화면 표시는 기기 현지 시간으로 바꾼다.
- `trade_date`는 CME 거래일(date)이다. 달력 날짜가 아니다(17:00 CT에 바뀐다).
- 가격은 정밀 decimal로 저장한다(float 금지). 음수 가격을 허용한다(2020-04-20 WTI).
- enum 값
  - `commodity_code`: `GC` `SI` `CL` `NG`
  - `basis`(기준값): `FRONT`(대표월물) `KR`(한국형) `US`(미국형)
  - `ma_period`: 20 / 50 / 100 / 200
  - `window`(분포 기간 N): `Y3` `Y5` `Y10` `ALL`
  - `direction`: `UP` `DOWN`
- `rare_level`은 0.1~49.9의 decimal(3,1)이다.
- 자동 수집 데이터에는 `source`(수집 소스)와 `collected_at`을 둔다. 소스 이름: `DATABENTO` `MASSIVE` `YAHOO` `NAVER` `KRX` `NASDAQ`(D-012, D-016).

## 영역 구분
| 영역 | 테이블 | 갱신 주체 |
|---|---|---|
| 1. 시장 기준 데이터 | `commodity`, `contract`, `active_month_rule`, `trading_day` | 달력 입력 스크립트(점검은 `CALENDAR` 작업, D-047), 일일 정산 배치(월물 상장) |
| 2. 시세 원천 | `daily_bar`, `intraday_snapshot` | 일일 정산 배치, 장중 배치 |
| 3. 계산 결과 | `roll_rule`, `roll_weight`, `index_bar`, `index_scale`, `disparity`, `disparity_distribution`, `index_snapshot` | 일일 정산 배치, 장중 배치 |
| 4. ETP | `etp_product`, `etp_series` | ETP 목록 배치 |
| 5. 설정·알림 | `app_settings`, `device`, `alert_record` | API, 장중 배치, 지연 발송 배치 |
| 6. 운영 | `batch_run` | 모든 배치 |

## 1~3. 시장 데이터와 계산 결과
```mermaid
erDiagram
    commodity ||--o{ contract : "월물"
    commodity ||--o{ active_month_rule : "활성 월물(금속)"
    contract ||--o{ daily_bar : "일봉"
    contract ||--o{ intraday_snapshot : "장중 스냅숏"
    commodity ||--o{ roll_rule : "한국형·미국형 규칙"
    contract ||--o{ roll_weight : "날짜별 비중"
    commodity ||--o{ index_bar : "기준값 지수"
    commodity ||--o{ index_scale : "가격 수준 맞춤"
    commodity ||--o{ disparity : "48개 시계열"
    commodity ||--o{ disparity_distribution : "192개 분포"
    commodity ||--o{ index_snapshot : "오늘 잠정 지수"

    commodity {
        string code PK "GC/SI/CL/NG"
        string name_ko
        string name_en
        string exchange "COMEX/NYMEX"
        int price_decimals "NG 3, CL 2, GC 1, SI 3"
        int sort_order
        bool uses_active_months "금속 true"
    }
    contract {
        string symbol PK "표준 심볼 예: CLZ26(루트+월 코드+연도 2자리), D-049"
        string commodity_code FK
        string contract_month "YYYY-MM"
        date first_trade_date
        date last_trade_date "최종 거래일, 소스의 계약 정의 값"
        bool is_target "대상 월물 여부(금속은 활성 월물만)"
    }
    active_month_rule {
        string commodity_code PK,FK
        date valid_from PK
        date valid_to "null=현재"
        string months "금 2,4,6,8,10,12 / 은 3,5,7,9,12"
    }
    trading_day {
        date trade_date PK "CME 거래일"
        timestamp session_open_at "직전 세션 재개 17:00 CT(주말·공휴일이면 그 이전)"
        timestamp session_close_at "16:00 CT 또는 조기 마감"
        timestamp halt_start_at "공휴일 중간 정지 시작(예: 13:30 CT), 없으면 null"
        timestamp halt_end_at "중간 정지 후 재개(17:00 CT), 없으면 null"
        bool is_early_close
        string note "휴장·조기 마감 사유"
    }
    daily_bar {
        string contract_symbol PK,FK
        date trade_date PK
        decimal open
        decimal high
        decimal low
        decimal settle "정산가"
        bigint volume
        string source
        timestamp collected_at
        timestamp revised_at "정산가 정정 시"
    }
    intraday_snapshot {
        string contract_symbol PK,FK
        timestamp captured_at PK "15분 배치 시각"
        date trade_date
        decimal last "현재가"
        decimal day_open
        decimal day_high "Yahoo 당일 고가"
        decimal day_low "Yahoo 당일 저가"
        bigint volume
        timestamp source_time "소스 기준 시각(지연 표시용)"
    }
    roll_rule {
        string commodity_code PK,FK
        string basis PK "KR/US"
        string rule_id "적용 규칙 GSCI/BCOM/BCBCLI"
        json params "롤 기간, 대상 월물, 일별 비중 이동"
        string adopted_from "규칙을 가져온 ETP·근거"
        string majority_rule_id "ETP 배치의 최근 다수 판정(D-024)"
        timestamp majority_checked_at
    }
    roll_weight {
        string commodity_code PK,FK
        string basis PK "FRONT/KR/US"
        date trade_date PK
        string contract_symbol PK,FK
        decimal weight "그날 종가 뒤 수량 기준 비중, 날짜별 합 1. FRONT는 1.0"
    }
    index_bar {
        string commodity_code PK,FK
        string basis PK
        date trade_date PK
        decimal open "맞춤 전 원래 지수"
        decimal high
        decimal low
        decimal close
        decimal blended_price "Σ 그날 종가 뒤 비중 × 정산가"
        bool is_valid "혼합 가격 0 이하면 false(산출 불가)"
        bool in_roll_period "롤 구간 음영·전환 마커용"
    }
    index_scale {
        string commodity_code PK,FK
        string basis PK
        decimal ratio "응답 시 곱하는 비율"
        timestamp updated_at
    }
    disparity {
        string commodity_code PK,FK
        string basis PK
        int ma_period PK
        date trade_date PK
        decimal ma "이평선(원래 지수 단위)"
        decimal disparity "이격도 %, 초기 기간-1일은 null"
    }
    disparity_distribution {
        string commodity_code PK,FK
        string basis PK
        int ma_period PK
        string window PK "Y3/Y5/Y10/ALL"
        date as_of_trade_date "기준 거래일"
        date actual_start_date "실제로 쓴 기간 표시용"
        int sample_count
        array sorted_values "오름차순 이격도"
    }
    index_snapshot {
        string commodity_code PK,FK
        string basis PK
        timestamp captured_at PK
        date trade_date
        decimal open
        decimal high
        decimal low
        decimal last
        json disparity_by_ma "이평선 4종 현재가·고가·저가 이격도"
    }
```

설명
- **거래일(`trading_day`)**: 정산가가 나오는 날만 행으로 둔다. 미국 공휴일 중간 정지일은 행이 없고, 그 세션은 다음 거래일 행의 `halt_*`로 표현한다. 에너지·금속은 같은 일정이라 거래소 구분 키가 없다(`research/cme-calendar.md`).
  - 과거 행(2010-06~)은 Databento 일봉에 정산가가 있는 날짜로 만들고, `pandas_market_calendars`로 1회 대조해 다른 날만 사람이 확인한다. 과거 행은 `trade_date`만 채우고 세션·정지 시각은 비운다(장중 판정에 쓰지 않음). 세션 시각은 운영 시작 이후 행에 넣는다(D-048).
- **월물(`contract`)**: 금속의 비활성 월물도 행은 만들 수 있지만 `is_target=false`로 두고 목록·커브·대표월물 후보에서 뺀다. 활성 월물 달력이 바뀌면 `active_month_rule`에 새 행을 넣고 `is_target`을 다시 계산한다.
- **롤 규칙(`roll_rule.params`)**: 일정(leg) 여러 개와 공통 설정으로 표현한다(`research/roll-rules.md`, D-013, 형태는 D-065). 이력은 두지 않는다. 규칙을 바꾸면 그 원자재·기준값의 계산 결과를 처음부터 다시 만든다(D-024).
  - 공통: 영업일 달력 `calendar`(`NYSE`/`BCOM`/`NYMEX`, `trading_day`에 NYSE만 쉰 날을 빼서 계산), 롤 영업일 순번 `rollDays`와 그날 종가 뒤 이전 월물 비중 `oldShares`(예: GSCI `[5,6,7,8,9]`, `[0.8,0.6,0.4,0.2,0]`), 재조정 `rebalance`(`null` 또는 `{months:[3,9], businessDay:1}`)
  - leg마다(`legs`): 가치 비중 `weight`(예: 1 또는 1/3)와 매월 1영업일 보유 월물 표 `hold`(12칸, 예: GSCI GC `G J J M M Q Q Z Z Z Z G+1`)
  - `roll_weight`는 이 규칙을 날짜별로 펼친 결과다. leg 수량은 롤해도 유지하고(BCOM·BCBCLI의 CIM), 재조정 달에는 재조정일 종가에 다음 월물 가격으로 새 수량을 정해 롤과 함께 옮긴다(D-065). 그 사이 수량을 유지해 비중 drift를 재현한다.
- **대표월물 이력**: 별도 테이블 없이 `roll_weight`(basis=`FRONT`, weight=1)로 표현한다. 세 기준값 모두 행 t는 그날 종가 뒤 보유 비중이라 FRONT 행 t는 다음 거래일 대표월물이다(D-066). 전환일 마커는 전일과 월물이 바뀐 날(옛 대표월물의 마지막 날)이다.
- **기준값이 없는 원자재**: 그 원자재·basis의 `roll_rule`이 없으면 `roll_weight`·`index_bar`도 없고, API가 `FRONT`로 대신 응답하면서 대체 여부를 함께 알린다.
- **지수**: `index_bar`에는 원래 지수만 저장하고 가격 수준 맞춤 비율은 `index_scale`에 한 행으로 둔다. 첫 유효일 지수는 그날 혼합 가격이다. 지수나 혼합 가격이 0 이하인 날은 산출 불가이고, 비율은 마지막 유효일의 `blended_price / close`다(D-066).
- **이격도**: `disparity`는 원자재 4 × 기준값 3 × 이평선 4 = 48개 시계열, `disparity_distribution`은 × N 4종 = 192행이다. 일일 정산 배치가 통째로 다시 쓴다. 산출 불가 기간은 `disparity`에 행을 두지 않고, 이평선은 유효 종가만 이어 K개로 계산한다. 분포는 기준 거래일 − N년 초과인 날의 이격도이고 `actual_start_date`는 쓴 첫 표본의 거래일이다(D-067).
- **오늘 잠정 봉**: 장중 배치가 `index_snapshot`에 쓴다. 알림 판정은 이 고가·저가 이격도를 쓰고, C-a의 오늘 봉은 가장 최근 스냅숏을 쓴다.
- **커브**: 테이블을 두지 않는다. 월물은 날짜별 직전 20거래일 평균 `daily_bar.volume` 100계약 기준으로 고르고, 기준값은 서버 상수다(D-018). `daily_bar`(기준일)와 최신 `intraday_snapshot` 또는 `daily_bar`(D)로 조회 시 만든다. 캐시나 materialized view는 두지 않는다. 커브 라우트만 원천값을 읽어 `calc` 함수로 만든다(D-046, D-068).
- **보관 기간**: `daily_bar`·`index_bar`·`disparity`는 Databento 적재 시작(2010-06-06, 첫 거래일은 2010-06-07)부터 영구 보관한다. C-b 기준일 하한은 가장 이른 `trade_date`다(D-020). `intraday_snapshot`·`index_snapshot`은 90일, `alert_record`·`batch_run`은 1년 보관한다(D-046).

## 4. ETP
```mermaid
erDiagram
    commodity ||--o{ etp_product : "추종"
    etp_product ||--|{ etp_series : "종목코드(ETN 시리즈)"

    etp_product {
        uuid id PK
        string commodity_code FK
        string market "KRX/US"
        string type "ETF/ETN"
        decimal leverage "예: 1, 2, -1, -2"
        string fx_hedge "HEDGED/UNHEDGED/NA(미국 상장)"
        string name "원문"
        string name_lang "ko/en"
        string issuer "운용사·발행사"
        string underlying_index "분류 근거 필드"
        decimal expense_ratio "총보수 %"
        string issuer_url
        decimal aum "순자산. 국내 ETF totalNav, ETN 시가총액, 미국 totalAssets"
        decimal avg_trading_value "최근 20거래일 평균 거래대금(종가×거래량, 시리즈 합산)"
        string grouping_key "발행사|원자재|배수|환헤지 (ETN 시리즈 묶기)"
        bool needs_review "미국 새 후보, 매핑 전까지 목록 제외"
        timestamp review_notified_at "새 후보 알림 1회(D-025)"
        string roll_rule_ref "한국형·미국형 다수 판정용"
        bool is_active "모든 시리즈가 상장폐지되면 false"
        string source
        timestamp collected_at
    }
    etp_series {
        string ticker PK "종목코드"
        uuid product_id FK
        string series_code "ETN A/B..., ETF는 null"
        date listed_date
        date maturity_date "ETN만"
        date delisted_date "상장폐지 시"
    }
```

설명
- **ETN 후속 시리즈**: 상품(`etp_product`) 하나에 시리즈(`etp_series`) 여러 개다. ETF는 시리즈가 하나다. C-d-a는 `delisted_date`가 없는 시리즈를 모두 나란히 보여 준다.
- **상장폐지**: 이전 시리즈는 `delisted_date`만 채운다. 모든 시리즈가 폐지되면 `is_active=false`로 목록에서 뺀다. 이력은 지우지 않는다(다시 묶기 판정과 디버깅용).
- **상장일**: C-d-a의 상장일은 상품의 첫 시리즈 `listed_date`다.
- **한국형·미국형 판정**: 상품별로 따르는 롤 규칙(`roll_rule_ref`)을 기록해 두면, 시장별 상품 수·AUM으로 다수 규칙을 다시 고를 수 있다. 값은 지수 이름이 아니라 규칙 식별자다(예: `GSCI`, `BCOM`, `BCBCLI`, `USO`). 지수 회사가 달라도 월물 일정·롤 시점이 같으면 같은 식별자를 쓴다(DJCI는 `GSCI`). `roll_rule.rule_id`와 같은 체계지만 FK는 아니다. 다수가 `rule_id`와 다르면 `majority_rule_id`에 기록하고 알린다(D-024).
- **미국 분류 매핑표**: 심볼 → 원자재·배수·`roll_rule_ref`를 코드의 시드 데이터로 둔다(D-016). 매핑표에 없는 후보는 `needs_review=true`로 저장하고 목록에서 뺀다. 알림은 처음 발견한 배치에서 1회 보내고 `review_notified_at`에 남긴다(D-025).
- **다수 판정 하한**: `aum`이 미국 $10M, 국내 10억 원 미만인 상품은 세지 않는다(D-015).
- **필터·정렬 값**: `market`, `type`, `leverage`, `fx_hedge`, `name`으로 C-d의 필터 4종과 기본 정렬을 처리하고, `aum`·`avg_trading_value`로 정렬 선택을 처리한다(D-017). 통화는 `market`으로 정해진다(KRX 원, US 달러).
- **평균 거래대금**: 일별 이력 테이블을 두지 않는다. ETP 배치가 매일 최근 45일 일봉(연휴가 껴도 20거래일을 채우도록)(국내 네이버 `siseJson`, 미국 Yahoo `chart`)을 받아 다시 계산해 덮어쓴다. 거래가 없는 날(거래량 0)은 0으로 넣고, 값이 빠진 날은 뺀다.

## 5~6. 설정·알림·운영
> 사용자는 본인 1명이다(D-011). 사용자 테이블 없이 설정을 단일 행으로 둔다.

```mermaid
erDiagram
    app_settings {
        int id PK "항상 1(단일 행)"
        string locale "ko/en, 푸시 문구용. 마지막으로 바꾼 기기의 값"
        string timezone "IANA, 알림 거부 시간 계산용"
        string basis "기본 FRONT"
        int ma_period "기본 100"
        string window "기본 Y10"
        array rare_levels "5개, 오름차순, 기본 5/10/15/20/25"
        string alert_commodity "null=알림 꺼짐"
        int quiet_start_min "null=끄기, 0~1410, 30 단위"
        int quiet_end_min "start와 달라야 함"
        timestamp updated_at
    }
    device {
        uuid id PK
        string platform "IOS/ANDROID"
        string push_token "UK"
        string app_version
        timestamp updated_at
    }
    alert_record {
        uuid id PK
        string commodity_code "중복 방지 키 1"
        string basis "키 2"
        int ma_period "키 3"
        string window "키 4"
        string direction "키 5 UP/DOWN"
        decimal rare_level "키 6"
        date trade_date "키 7 CME 거래일"
        string status "SENT/HELD/SUPPRESSED/RETRY/FAILED"
        decimal disparity "판정 이격도(고가·저가 기준)"
        timestamp detected_at "판정 시각"
        timestamp sent_at "지연 발송이면 detected_at과 다름"
    }
    batch_run {
        uuid id PK
        string job "DAILY_SETTLE/INTRADAY/DEFERRED_PUSH/ETP/CALENDAR/BACKUP"
        date trade_date
        timestamp scheduled_at
        timestamp started_at
        timestamp finished_at
        string status "RUNNING/SUCCESS/FAILED"
        int attempt "재시도 1회"
        string error
        timestamp ops_notified_at "운영 알림 보낸 시각(D-045, D-048)"
    }
```

설명
- **단일 사용자**: 로그인·계정이 없어 사용자 식별 컬럼을 두지 않는다. 서버 접근은 단일 비밀 값(접근 키)으로 막는다. 키는 서버 환경 변수와 기기 SecureStore에만 있다(D-044).
- **설정**: `app_settings`는 처음 배포할 때 기본값 한 행으로 만든다. 알림 거부 시간은 현지 시각을 자정 기준 분으로 저장하고 `app_settings.timezone`으로 해석한다. 시간대는 앱 실행 때 기기가 보고한 값으로, 마지막으로 실행한 기기의 값을 쓴다.
- **기기·푸시 토큰**: 앱 실행 때 등록·갱신한다(`push_token` 유니크). 발송 결과가 "유효하지 않은 토큰"이면 행을 지운다.
- **`alert_record`**: 중복 방지 기록과 보류 큐를 한 테이블로 처리한다.
  - 중복 방지 키(D-006) 7개에 유니크 제약을 건다. 같은 키의 두 번째 판정은 insert가 실패하므로 다시 보내지 않는다.
  - `SENT`: 보냄. `HELD`: 알림 거부 시간이라 보류. `SUPPRESSED`: 같은 판정에서 더 드문 레벨에 밀린 덜 드문 레벨, 또는 지연 발송 때 방향별 최상위 1건에 밀린 보류 건. `RETRY`: 모든 기기에 발송 실패, 다음 주기에 1회 다시 보냄(그사이 같은 방향의 더 드문 레벨을 보냈으면 `SUPPRESSED`). `FAILED`: 재시도도 실패(D-023).
  - 모든 상태가 유니크 키를 차지하므로 "그날 보낸 것"으로 쳐서 중복 방지에 쓴다.
  - 지연 발송 배치는 거부 시간이 끝나면 `HELD`를 방향별로 묶어 가장 드문 1건을 `SENT`로, 나머지를 `SUPPRESSED`로 바꾼다.
  - 보관 기간은 1년이다(중복 방지에는 당일 기록만 필요, D-046).
- **`batch_run`**: 운영 알림의 거래일당 1회 판단(`ops_notified_at`, D-048), 앱 상단 기준 시각 줄의 "마지막 성공 시각", 실패 시 1회 재시도, "일일 정산 실패 시 알림 판정 중지", 정산 대기(직전 거래일 `DAILY_SETTLE` 성공 전, D-022)를 이 테이블로 판단한다.

## 서버에 두지 않는 데이터 (기기 저장)
| 데이터 | 비고 |
|---|---|
| 표시 설정(언어, 등락 색) | 언어는 `app_settings.locale`로도 보냄 |
| 기간 버튼 선택(C-a·C-c 따로) | Zustand persist(D-047) |
| 서버 접근 키 | `expo-secure-store`, B-b에서 QR·붙여넣기로 입력(D-044) |

## 리서치 후 확정할 항목
- `etp_series.maturity_date`·`listed_date`(국내 ETN), `etp_product.underlying_index`(국내 ETN): KRX Open API 인증키를 받아 필드를 확인한 뒤 소스를 정한다.

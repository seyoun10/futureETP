// Drizzle 테이블 정의. 논리 모델은 docs/data-model.md, 물리 타입 결정은 D-058.
// 컬럼 이름은 casing: 'snake_case'로 자동 변환한다(client.ts·drizzle.config.ts).
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import {
  BASES,
  COMMODITY_CODES,
  DIRECTIONS,
  ETP_MARKETS,
  ETP_TYPES,
  FX_HEDGES,
  LOCALES,
  PLATFORMS,
  WINDOWS,
  type MaPeriod,
} from '@futureetp/shared';
import type { DisparityByMa } from '../calc/intraday.ts';
import { ALERT_STATUSES, BATCH_STATUSES, JOB_NAMES, SOURCES } from '../constants.ts';

// 가격·비중은 정밀 decimal로 저장하고 calc에서 쓰기 쉽게 number로 읽는다.
const decimal = () => numeric({ mode: 'number' });
const utc = () => timestamp({ withTimezone: true });
// trade_date 등 날짜는 'YYYY-MM-DD' 문자열로 읽는다.
const day = () => date({ mode: 'string' });

const commodityCode = () => text({ enum: COMMODITY_CODES });
const basis = () => text({ enum: BASES });
const maPeriod = () => integer().$type<MaPeriod>();
const distWindow = () => text({ enum: WINDOWS });
const source = () => text({ enum: SOURCES });

// 1. 시장 기준 데이터

export const commodity = pgTable('commodity', {
  code: commodityCode().primaryKey(),
  nameKo: text().notNull(),
  nameEn: text().notNull(),
  exchange: text({ enum: ['COMEX', 'NYMEX'] }).notNull(),
  priceDecimals: integer().notNull(),
  sortOrder: integer().notNull(),
  usesActiveMonths: boolean().notNull(),
});

export const contract = pgTable(
  'contract',
  {
    // 표준 심볼(예: CLZ26, D-049)
    symbol: text().primaryKey(),
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    // YYYY-MM
    contractMonth: text().notNull(),
    firstTradeDate: day(),
    // 소스의 계약 정의 값
    lastTradeDate: day().notNull(),
    isTarget: boolean().notNull(),
  },
  (t) => [index().on(t.commodityCode, t.lastTradeDate)],
);

export const activeMonthRule = pgTable(
  'active_month_rule',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    validFrom: day().notNull(),
    // null = 현재
    validTo: day(),
    // 1~12 (금 2,4,6,8,10,12 / 은 3,5,7,9,12)
    months: integer().array().notNull(),
  },
  (t) => [primaryKey({ columns: [t.commodityCode, t.validFrom] })],
);

// 정산가가 나오는 CME 거래일만 행으로 둔다. 과거 행은 세션·정지 시각이 비어 있다(D-048).
export const tradingDay = pgTable('trading_day', {
  tradeDate: day().primaryKey(),
  sessionOpenAt: utc(),
  sessionCloseAt: utc(),
  haltStartAt: utc(),
  haltEndAt: utc(),
  isEarlyClose: boolean().notNull().default(false),
  note: text(),
});

// 2. 시세 원천

export const dailyBar = pgTable(
  'daily_bar',
  {
    contractSymbol: text()
      .notNull()
      .references(() => contract.symbol),
    tradeDate: day().notNull(),
    open: decimal(),
    high: decimal(),
    low: decimal(),
    settle: decimal().notNull(),
    volume: bigint({ mode: 'number' }).notNull(),
    source: source().notNull(),
    collectedAt: utc().notNull(),
    revisedAt: utc(),
  },
  // 커브 조회는 날짜별로 여러 월물을 읽는다(D-046).
  (t) => [primaryKey({ columns: [t.contractSymbol, t.tradeDate] }), index().on(t.tradeDate)],
);

export const intradaySnapshot = pgTable(
  'intraday_snapshot',
  {
    contractSymbol: text()
      .notNull()
      .references(() => contract.symbol),
    capturedAt: utc().notNull(),
    tradeDate: day().notNull(),
    last: decimal().notNull(),
    dayOpen: decimal(),
    dayHigh: decimal(),
    dayLow: decimal(),
    volume: bigint({ mode: 'number' }),
    sourceTime: utc(),
  },
  (t) => [primaryKey({ columns: [t.contractSymbol, t.capturedAt] }), index().on(t.capturedAt)],
);

// 3. 계산 결과

export const rollRule = pgTable(
  'roll_rule',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    // KR/US만(FRONT는 규칙이 없다)
    basis: text({ enum: ['KR', 'US'] }).notNull(),
    ruleId: text().notNull(),
    // 형태는 5-2 calc 롤 비중에서 확정한다(research/roll-rules.md, D-013).
    params: jsonb().notNull(),
    adoptedFrom: text(),
    majorityRuleId: text(),
    majorityCheckedAt: utc(),
  },
  (t) => [primaryKey({ columns: [t.commodityCode, t.basis] })],
);

// 대표월물 이력은 basis=FRONT, weight=1 행으로 표현한다.
export const rollWeight = pgTable(
  'roll_weight',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    basis: basis().notNull(),
    tradeDate: day().notNull(),
    contractSymbol: text()
      .notNull()
      .references(() => contract.symbol),
    weight: decimal().notNull(),
  },
  (t) => [primaryKey({ columns: [t.commodityCode, t.basis, t.tradeDate, t.contractSymbol] })],
);

// 가격 수준 맞춤 전 원래 지수
export const indexBar = pgTable(
  'index_bar',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    basis: basis().notNull(),
    tradeDate: day().notNull(),
    open: decimal(),
    high: decimal(),
    low: decimal(),
    close: decimal(),
    blendedPrice: decimal().notNull(),
    // 혼합 가격 0 이하면 false(산출 불가). 이때 OHLC는 null
    isValid: boolean().notNull(),
    inRollPeriod: boolean().notNull(),
  },
  (t) => [primaryKey({ columns: [t.commodityCode, t.basis, t.tradeDate] })],
);

export const indexScale = pgTable(
  'index_scale',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    basis: basis().notNull(),
    ratio: decimal().notNull(),
    updatedAt: utc().notNull(),
  },
  (t) => [primaryKey({ columns: [t.commodityCode, t.basis] })],
);

export const disparity = pgTable(
  'disparity',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    basis: basis().notNull(),
    maPeriod: maPeriod().notNull(),
    tradeDate: day().notNull(),
    // 이평선(원래 지수 단위)
    ma: decimal(),
    // 이격도 %, 초기 기간-1일은 null
    disparity: decimal(),
  },
  (t) => [primaryKey({ columns: [t.commodityCode, t.basis, t.maPeriod, t.tradeDate] })],
);

export const disparityDistribution = pgTable(
  'disparity_distribution',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    basis: basis().notNull(),
    maPeriod: maPeriod().notNull(),
    window: distWindow().notNull(),
    asOfTradeDate: day().notNull(),
    actualStartDate: day().notNull(),
    sampleCount: integer().notNull(),
    // 오름차순 이격도. 계산 결과라 double로 둔다(D-058).
    sortedValues: doublePrecision().array().notNull(),
  },
  (t) => [primaryKey({ columns: [t.commodityCode, t.basis, t.maPeriod, t.window] })],
);

export const indexSnapshot = pgTable(
  'index_snapshot',
  {
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    basis: basis().notNull(),
    capturedAt: utc().notNull(),
    tradeDate: day().notNull(),
    open: decimal(),
    high: decimal(),
    low: decimal(),
    last: decimal(),
    disparityByMa: jsonb().$type<DisparityByMa>().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.commodityCode, t.basis, t.capturedAt] }),
    index().on(t.capturedAt),
  ],
);

// 4. ETP

// 미국 새 후보(needs_review)는 매핑표(D-016)에 넣기 전이라 원자재·종류·배수·규칙이 비어 있을 수 있다.
export const etpProduct = pgTable(
  'etp_product',
  {
    id: uuid().primaryKey().defaultRandom(),
    commodityCode: commodityCode().references(() => commodity.code),
    market: text({ enum: ETP_MARKETS }).notNull(),
    type: text({ enum: ETP_TYPES }),
    // 예: 1, 2, -1, -2
    leverage: decimal(),
    fxHedge: text({ enum: FX_HEDGES }).notNull(),
    // 원문
    name: text().notNull(),
    nameLang: text({ enum: LOCALES }).notNull(),
    issuer: text(),
    // 국내 ETN은 KRX IDX_IND_NM(D-096)
    underlyingIndex: text(),
    // 총보수 %
    expenseRatio: decimal(),
    issuerUrl: text(),
    // 국내 ETF totalNav, ETN 시가총액, 미국 totalAssets. 통화는 market으로 정해진다.
    aum: decimal(),
    // 최근 20거래일 평균(국내 KRX 거래대금, 미국 종가×거래량. ETN은 상장 중 시리즈 합산, D-017)
    avgTradingValue: decimal(),
    // 발행사|원자재|배수|환헤지 (ETN 시리즈 묶기, D-096)
    groupingKey: text(),
    needsReview: boolean().notNull().default(false),
    // 새 후보 알림 1회(D-025)
    reviewNotifiedAt: utc(),
    // roll_rule.rule_id와 같은 식별자 체계, FK 아님(D-024)
    rollRuleRef: text(),
    // 모든 시리즈가 상장폐지되면 false
    isActive: boolean().notNull().default(true),
    source: source().notNull(),
    collectedAt: utc().notNull(),
  },
  (t) => [index().on(t.commodityCode), index().on(t.groupingKey)],
);

// ETF는 시리즈 1개다. 국내 ETN 상장일·만기일은 자동 소스가 없어 손으로 넣는다(D-096).
export const etpSeries = pgTable(
  'etp_series',
  {
    // 종목코드(국내 6자리, 미국 심볼)
    ticker: text().primaryKey(),
    productId: uuid()
      .notNull()
      .references(() => etpProduct.id),
    // ETN A/B..., ETF는 null
    seriesCode: text(),
    listedDate: day(),
    // ETN만
    maturityDate: day(),
    delistedDate: day(),
  },
  (t) => [index().on(t.productId)],
);

// 5. 설정·알림

// 단일 행(id=1). 기본값은 product.md 전역 설정
export const appSettings = pgTable(
  'app_settings',
  {
    id: integer().primaryKey().default(1),
    locale: text({ enum: LOCALES }).notNull().default('ko'),
    // IANA. 앱 실행 때 기기가 PATCH /v1/settings로 올린다(D-048).
    timezone: text().notNull().default('Asia/Seoul'),
    basis: basis().notNull().default('FRONT'),
    maPeriod: maPeriod().notNull().default(100),
    window: distWindow().notNull().default('Y10'),
    rareLevels: numeric({ precision: 3, scale: 1, mode: 'number' })
      .array()
      .notNull()
      .default(sql`'{1,2,4,8,16}'`),
    // null = 알림 꺼짐
    alertCommodity: commodityCode().references(() => commodity.code),
    // 현지 자정 기준 분. 둘 다 null(끄기)이거나 둘 다 있고 서로 다르다.
    quietStartMin: integer(),
    quietEndMin: integer(),
    updatedAt: utc().notNull().defaultNow(),
  },
  (t) => [
    check('app_settings_single_row', sql`${t.id} = 1`),
    check(
      'app_settings_quiet_time',
      sql`(${t.quietStartMin} IS NULL AND ${t.quietEndMin} IS NULL) OR (
        ${t.quietStartMin} BETWEEN 0 AND 1410 AND ${t.quietStartMin} % 30 = 0
        AND ${t.quietEndMin} BETWEEN 0 AND 1410 AND ${t.quietEndMin} % 30 = 0
        AND ${t.quietStartMin} <> ${t.quietEndMin})`,
    ),
  ],
);

export const device = pgTable('device', {
  id: uuid().primaryKey().defaultRandom(),
  platform: text({ enum: PLATFORMS }).notNull(),
  pushToken: text().notNull().unique(),
  appVersion: text(),
  updatedAt: utc().notNull().defaultNow(),
});

// 중복 방지 기록과 보류 큐를 겸한다. 모든 상태가 중복 방지 키를 차지한다(D-006, D-023).
export const alertRecord = pgTable(
  'alert_record',
  {
    id: uuid().primaryKey().defaultRandom(),
    commodityCode: commodityCode()
      .notNull()
      .references(() => commodity.code),
    basis: basis().notNull(),
    maPeriod: maPeriod().notNull(),
    window: distWindow().notNull(),
    direction: text({ enum: DIRECTIONS }).notNull(),
    rareLevel: numeric({ precision: 3, scale: 1, mode: 'number' }).notNull(),
    tradeDate: day().notNull(),
    status: text({ enum: ALERT_STATUSES }).notNull(),
    disparity: decimal().notNull(),
    detectedAt: utc().notNull(),
    sentAt: utc(),
  },
  (t) => [
    unique('alert_record_dedup_key').on(
      t.commodityCode,
      t.basis,
      t.maPeriod,
      t.window,
      t.direction,
      t.rareLevel,
      t.tradeDate,
    ),
    index().on(t.status),
  ],
);

// 6. 운영

export const batchRun = pgTable(
  'batch_run',
  {
    id: uuid().primaryKey().defaultRandom(),
    job: text({ enum: JOB_NAMES }).notNull(),
    tradeDate: day(),
    scheduledAt: utc(),
    startedAt: utc().notNull(),
    finishedAt: utc(),
    status: text({ enum: BATCH_STATUSES }).notNull(),
    attempt: integer().notNull().default(1),
    error: text(),
    opsNotifiedAt: utc(),
  },
  (t) => [index().on(t.job, t.startedAt)],
);

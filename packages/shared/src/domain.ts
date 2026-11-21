// API·DB에서 함께 쓰는 도메인 값(docs/data-model.md 공통 규약). TS enum 대신 상수 문자열을 쓴다(D-051).
export const COMMODITY_CODES = ['GC', 'SI', 'CL', 'NG'] as const;
export type CommodityCode = (typeof COMMODITY_CODES)[number];

// 기준값: 대표월물·한국형·미국형
export const BASES = ['FRONT', 'KR', 'US'] as const;
export type Basis = (typeof BASES)[number];

export const MA_PERIODS = [20, 50, 100, 200] as const;
export type MaPeriod = (typeof MA_PERIODS)[number];

// 분포 기간 N
export const WINDOWS = ['Y3', 'Y5', 'Y10', 'ALL'] as const;
export type Window = (typeof WINDOWS)[number];

export const DIRECTIONS = ['UP', 'DOWN'] as const;
export type Direction = (typeof DIRECTIONS)[number];

export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const PLATFORMS = ['IOS', 'ANDROID'] as const;
export type Platform = (typeof PLATFORMS)[number];

// ETP 상장 시장·종류·환헤지(C-d 필터, data-model.md 4. ETP). 미국 상장은 환헤지 구분이 없어 NA다.
export const ETP_MARKETS = ['KRX', 'US'] as const;
export type EtpMarket = (typeof ETP_MARKETS)[number];

export const ETP_TYPES = ['ETF', 'ETN'] as const;
export type EtpType = (typeof ETP_TYPES)[number];

export const FX_HEDGES = ['HEDGED', 'UNHEDGED', 'NA'] as const;
export type FxHedge = (typeof FX_HEDGES)[number];

// 장 상태(D-022, architecture.md freshness)
export const MARKET_STATES = ['OPEN', 'CLOSED', 'SETTLEMENT_PENDING'] as const;
export type MarketState = (typeof MARKET_STATES)[number];

// 커브 상태(M1→M2로 판정, product.md 월물커브)
export const CURVE_STATES = ['CONTANGO', 'BACKWARDATION', 'FLAT'] as const;
export type CurveState = (typeof CURVE_STATES)[number];

// 배치 작업 이름. 스케줄러 등록 이름·CLI 인자·Healthchecks.io check slug와 같다(D-045).
// 일일 정산은 ① DAILY_SETTLE(당일 저장·재계산, 성공 = 정산 대기 해제)과 ② SETTLE_REVISION(전일 정정 확인)이고, 주말에 ③ SETTLE_BACKFILL(빠진 봉 보충·바뀐 값 수정, D-110)이 돈다.
export const JOB_NAMES = [
  'DAILY_SETTLE',
  'SETTLE_REVISION',
  'SETTLE_BACKFILL',
  'INTRADAY',
  'DEFERRED_PUSH',
  'ETP',
  'CALENDAR',
  'BACKUP',
] as const;
export type JobName = (typeof JOB_NAMES)[number];

// 휴장 달력 시장(CME 원자재 선물, KRX·NYSE ETP 상장 시장)과 예외 일정 종류.
// HALT는 CME 공휴일 중간 정지(정산 없음), LATE_OPEN은 KRX 연초·수능일 개장 지연이다.
export const CALENDAR_MARKETS = ['CME', 'KRX', 'NYSE'] as const;
export type CalendarMarket = (typeof CALENDAR_MARKETS)[number];

export const CALENDAR_EXCEPTION_KINDS = ['CLOSED', 'HALT', 'EARLY_CLOSE', 'LATE_OPEN'] as const;
export type CalendarExceptionKind = (typeof CALENDAR_EXCEPTION_KINDS)[number];

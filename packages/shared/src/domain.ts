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

// 장 상태(D-022, architecture.md freshness)
export const MARKET_STATES = ['OPEN', 'CLOSED', 'SETTLEMENT_PENDING'] as const;
export type MarketState = (typeof MARKET_STATES)[number];

// 커브 상태(M1→M2로 판정, product.md 월물커브)
export const CURVE_STATES = ['CONTANGO', 'BACKWARDATION', 'FLAT'] as const;
export type CurveState = (typeof CURVE_STATES)[number];

// 배치 작업 이름. 스케줄러 등록 이름·CLI 인자·Healthchecks.io check slug와 같다(D-045).
// 일일 정산은 ① DAILY_SETTLE(당일 저장·재계산, 성공 = 정산 대기 해제)과 ② SETTLE_REVISION(전일 정정 확인)이다(D-071).
export const JOB_NAMES = [
  'DAILY_SETTLE',
  'SETTLE_REVISION',
  'INTRADAY',
  'DEFERRED_PUSH',
  'ETP',
  'CALENDAR',
  'BACKUP',
] as const;
export type JobName = (typeof JOB_NAMES)[number];

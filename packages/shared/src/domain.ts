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

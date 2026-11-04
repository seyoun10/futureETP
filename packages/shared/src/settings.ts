import { z } from 'zod';
import { BASES, COMMODITY_CODES, LOCALES, MA_PERIODS, WINDOWS } from './domain.ts';

// 전역 설정(product.md 전역 설정, data-model.md app_settings). GET·PATCH /v1/settings 응답 data다(D-081).
export const RARE_LEVEL_COUNT = 5;
export const RARE_LEVEL_MIN = 0.1;
export const RARE_LEVEL_MAX = 49.9;
// 알림 거부 시간: 현지 자정 기준 분, 30분 단위
export const QUIET_STEP_MIN = 30;
export const QUIET_MAX_MIN = 24 * 60 - QUIET_STEP_MIN;

const maPeriodSchema = z.literal(MA_PERIODS);

const quietMinuteSchema = z.number().int().min(0).max(QUIET_MAX_MIN).multipleOf(QUIET_STEP_MIN);

// null = 끄기. 자정 넘김(start > end)은 허용한다.
const quietTimeSchema = z
  .object({ startMin: quietMinuteSchema, endMin: quietMinuteSchema })
  .refine((time) => time.startMin !== time.endMin, 'startMin and endMin must differ')
  .nullable();

const timezoneSchema = z.string().refine((timeZone) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}, 'Invalid IANA time zone');

// 소수 첫째 자리까지. 부동소수 오차(0.3 = 0.30000000000000004 등)는 허용한다.
export const rareLevelSchema = z
  .number()
  .min(RARE_LEVEL_MIN)
  .max(RARE_LEVEL_MAX)
  .refine((level) => Math.abs(level * 10 - Math.round(level * 10)) < 1e-9, 'At most 1 decimal');

// rare 레벨 5개 입력(PATCH 본문, C-a 조회 query). 오름차순으로 정렬한다.
export const rareLevelsSchema = z
  .array(rareLevelSchema)
  .length(RARE_LEVEL_COUNT)
  .refine((levels) => new Set(levels).size === levels.length, 'Rare levels must be distinct')
  .transform((levels) => [...levels].sort((a, b) => a - b));

export const settingsSchema = z.object({
  locale: z.enum(LOCALES),
  timezone: z.string(),
  basis: z.enum(BASES),
  maPeriod: maPeriodSchema,
  window: z.enum(WINDOWS),
  // 오름차순 5개
  rareLevels: z.array(z.number()).length(RARE_LEVEL_COUNT),
  // null = 알림 꺼짐
  alertCommodity: z.enum(COMMODITY_CODES).nullable(),
  quietTime: z.object({ startMin: z.number(), endMin: z.number() }).nullable(),
});
export type Settings = z.infer<typeof settingsSchema>;

// PATCH 본문: 바꿀 필드만 보낸다. 모르는 필드는 거절한다. rare 레벨은 저장 전에 오름차순으로 정렬한다.
export const settingsPatchSchema = z.strictObject({
  locale: z.enum(LOCALES).optional(),
  timezone: timezoneSchema.optional(),
  basis: z.enum(BASES).optional(),
  maPeriod: maPeriodSchema.optional(),
  window: z.enum(WINDOWS).optional(),
  rareLevels: rareLevelsSchema.optional(),
  alertCommodity: z.enum(COMMODITY_CODES).nullable().optional(),
  quietTime: quietTimeSchema.optional(),
});
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

// 이격도차트 설정 기본값. 서버 device 설정 컬럼 기본값이고, 앱 B [초기화]가 이 값으로 PATCH한다.
export const DISPARITY_SETTINGS_DEFAULTS = {
  basis: 'FRONT',
  maPeriod: 100,
  window: 'Y10',
  rareLevels: [1, 2, 4, 8, 16],
} as const satisfies Pick<Settings, 'basis' | 'maPeriod' | 'window' | 'rareLevels'>;

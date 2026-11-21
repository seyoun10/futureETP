import { z } from 'zod';
import { BASES, MA_PERIODS, WINDOWS } from './domain.ts';
import { rareLevelsSchema } from './settings.ts';

// 조회 API의 query 문자열 스키마. 서버가 검증하고, API 계약(contract.ts, D-142)이 문서로 내보낸다.

// C-a·C-c 이전 3년 더 받기(D-104): 이 거래일보다 이른 봉만. 없으면 최근 3년
const beforeSchema = z.iso
  .date()
  .optional()
  .describe('이 거래일보다 이른 데이터만(이전 3년 더 받기, D-104). 없으면 최근 3년');

// GET /v1/commodities/:code/disparity. 앱은 설정 값을 query로 보낸다(D-086)
export const disparityQuerySchema = z.object({
  basis: z.enum(BASES),
  // 문자열 enum으로 받아 계약에 허용 값이 드러나게 한다
  ma: z.literal(MA_PERIODS.map(String)).transform(Number).pipe(z.literal(MA_PERIODS)),
  window: z.enum(WINDOWS),
  // 공백·16진수·지수 표기 등은 거절한다(D3). 개수·범위·자릿수는 rareLevelsSchema가 본다
  levels: z
    .string()
    .regex(/^\d+(\.\d+)?(,\d+(\.\d+)?)*$/)
    .describe('rare 레벨 5개를 쉼표로(예: 1,2.5,5,10,20). 설정 rareLevels와 같은 규칙')
    .transform((s) => s.split(',').map(Number))
    .pipe(rareLevelsSchema),
  before: beforeSchema,
});

// GET /v1/commodities/:code/contracts
export const contractsQuerySchema = z.object({ before: beforeSchema });

// GET /v1/commodities/:code/curve
export const curveQuerySchema = z.object({
  baseDate: z.iso.date().optional().describe('기준일. 서버가 거래일로 맞춘다(D-090)'),
});

// GET /v1/calendar. 앱은 이번 달 1일 ~ 다다음 달 말일을 보낸다
export const CALENDAR_MAX_DAYS = 366;
export const calendarQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date().describe(`from 이후, from부터 ${CALENDAR_MAX_DAYS}일 이내`),
  })
  .refine(
    ({ from, to }) => {
      const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
      return days >= 0 && days < CALENDAR_MAX_DAYS;
    },
    { message: `to must be on or after from and within ${CALENDAR_MAX_DAYS} days`, path: ['to'] },
  );

import { z } from 'zod';
import { CALENDAR_EXCEPTION_KINDS, CALENDAR_MARKETS } from './domain.ts';

// GET /v1/calendar 응답 data(휴장 달력 화면). 평일 중 예외 일정만 준다. 주말은 앱이 직접 센다.
export const calendarExceptionSchema = z.object({
  market: z.enum(CALENDAR_MARKETS),
  date: z.iso.date(),
  kind: z.enum(CALENDAR_EXCEPTION_KINDS),
  at: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .describe('그 시장 현지 시각 HH:mm(CME CT, KRX KST, NYSE ET). CLOSED는 null'),
  note: z.string().describe('휴일 이름. 입력 원문(CME·NYSE 영어, KRX 한국어)'),
});
export type CalendarException = z.infer<typeof calendarExceptionSchema>;

export const calendarSchema = z.object({
  from: z.iso.date(),
  to: z.iso.date(),
  // 날짜순, 같은 날은 시장 순(CALENDAR_MARKETS)
  exceptions: z.array(calendarExceptionSchema),
  missing: z
    .array(z.object({ market: z.enum(CALENDAR_MARKETS), year: z.number().int() }))
    .describe('범위에 걸친 연도 중 휴장 일정이 입력되지 않은 (시장, 연도)'),
});
export type Calendar = z.infer<typeof calendarSchema>;

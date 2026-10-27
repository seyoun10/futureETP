import { z } from 'zod';

// API 에러 코드(D-042). 앱은 `errors.<code>` i18n 키로 사용자 문구를 만든다.
export const API_ERROR_CODES = [
  'UNAUTHORIZED',
  'RATE_LIMITED',
  'VALIDATION_FAILED',
  'NOT_FOUND',
  'INTERNAL',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const errorSchema = z.object({
  code: z.enum(API_ERROR_CODES),
  message: z.string(),
});

export const envelopeSchema = <T extends z.ZodType>(data: T) =>
  z.discriminatedUnion('success', [
    z.object({ success: z.literal(true), data }),
    z.object({ success: z.literal(false), error: errorSchema }),
  ]);

export type ApiError = z.infer<typeof errorSchema>;

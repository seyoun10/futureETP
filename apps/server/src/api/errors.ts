import type { ApiErrorCode } from '@futureetp/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export const ERROR_STATUS = {
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  VALIDATION_FAILED: 400,
  NOT_FOUND: 404,
  INTERNAL: 500,
} as const satisfies Record<ApiErrorCode, ContentfulStatusCode>;

// 라우트·미들웨어에서 던지면 onError가 응답 봉투로 바꾼다(D-042).
export class ApiException extends Error {
  readonly code: ApiErrorCode;

  constructor(code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiException';
    this.code = code;
  }
}

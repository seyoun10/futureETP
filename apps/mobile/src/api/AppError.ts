import { API_ERROR_CODES } from '@futureetp/shared';

// 서버 코드 + 앱 전용 코드(D-042). 화면은 `code`만 보고 `errors.<code>` 문구를 고른다.
export const APP_ERROR_CODES = [
  ...API_ERROR_CODES,
  'NETWORK',
  'TIMEOUT',
  'SCHEMA_MISMATCH',
] as const;
export type AppErrorCode = (typeof APP_ERROR_CODES)[number];

const RETRYABLE_CODES: readonly AppErrorCode[] = ['NETWORK', 'TIMEOUT', 'INTERNAL'];

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status?: number;

  constructor(
    code: AppErrorCode,
    options: { message?: string; status?: number; cause?: unknown } = {},
  ) {
    super(options.message ?? code, { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.status = options.status;
  }
}

// TanStack Query 재시도 대상(D-042). 4xx·SCHEMA_MISMATCH·AppError가 아닌 오류는 재시도하지 않는다.
export const isRetryable = (error: unknown) =>
  error instanceof AppError && RETRYABLE_CODES.includes(error.code);

// 던져진 값을 로그·실패 기록용 문자열로 바꾼다
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

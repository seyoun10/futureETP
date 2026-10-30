import { z } from 'zod';

// C-a·C-c 차트는 최근 3년(연 252일)씩 나눠 준다. 앱은 가장 과거 봉이 화면에 보이면
// before=그 봉 날짜로 이전 3년을 더 받는다(D-104)
export const CHART_PAGE_BARS = 3 * 252;

export const beforeSchema = z.iso.date().optional();

// 거래일 오름차순 dates에서 before보다 이른 마지막 size개의 범위 [start, end)와 그보다 이른 날이 남았는지
export function pageRange(
  dates: readonly string[],
  before: string | undefined,
  size = CHART_PAGE_BARS,
): { start: number; end: number; hasMore: boolean } {
  const idx = before === undefined ? -1 : dates.findIndex((d) => d >= before);
  const end = idx === -1 ? dates.length : idx;
  const start = Math.max(0, end - size);
  return { start, end, hasMore: start > 0 };
}

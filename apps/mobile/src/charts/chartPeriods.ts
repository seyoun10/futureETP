import type { ChartPeriod } from '@/stores/displaySettings';

// 기간 버튼이 보여 주는 거래일 봉 수(월 21일·연 252일로 어림한다). '전체'는 모든 봉이다.
export const PERIOD_BARS: Record<ChartPeriod, number> = {
  '3M': 63,
  '6M': 126,
  '9M': 189,
  '12M': 252,
  '2Y': 504,
  '4Y': 1008,
  '6Y': 1512,
  '8Y': 2016,
  '10Y': 2520,
  ALL: Number.MAX_SAFE_INTEGER,
};

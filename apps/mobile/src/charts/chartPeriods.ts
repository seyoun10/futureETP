import { CHART_PERIODS } from '@/stores/displaySettings';
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

// 보이는 봉 수와 가장 가까운 기간(핀치 뒤 기간 칩 표시용). 기간이 배수로 늘어나므로 비율로 비교한다.
// 전체 봉 수보다 긴 기간은 '전체'와 같은 범위라 '전체'로 본다
export function nearestPeriod(visibleBars: number, totalBars: number): ChartPeriod {
  let best: ChartPeriod = 'ALL';
  let bestDistance = Infinity;
  for (const period of CHART_PERIODS) {
    const bars = Math.min(PERIOD_BARS[period], totalBars);
    if (period !== 'ALL' && bars === totalBars) continue;
    const distance = Math.abs(Math.log(visibleBars / bars));
    if (distance < bestDistance) {
      best = period;
      bestDistance = distance;
    }
  }
  return best;
}

import { CHART_PERIODS } from '@/stores/displaySettings';
import type { ChartPeriod } from '@/stores/displaySettings';

// 기간 버튼이 보여 주는 거래일 봉 수(월 21일로 어림한다)
export const PERIOD_BARS: Record<ChartPeriod, number> = {
  '2M': 42,
  '4M': 84,
  '6M': 126,
  '8M': 168,
  '10M': 210,
  '12M': 252,
};

// 차트에 넘기는 최대 봉 수(최근 5년, 연 252일). 첫 그리기 비용이 봉 수에 비례해(봉 4,126개에 약 1.6초)
// 기간 버튼 최대(12M)의 5배까지만 그린다. 핀치로 끝까지 축소해도 이 범위까지다(D-104)
export const MAX_CHART_BARS = 5 * 252;

// 보이는 봉 수와 가장 가까운 기간(핀치 뒤 기간 칩 표시용). 비율로 비교한다.
// 전체 봉 수보다 긴 기간은 전체 봉 수로 줄여 비교하고, 같으면 짧은 기간을 고른다
export function nearestPeriod(visibleBars: number, totalBars: number): ChartPeriod {
  let best: ChartPeriod = CHART_PERIODS[0];
  let bestDistance = Infinity;
  for (const period of CHART_PERIODS) {
    const bars = Math.min(PERIOD_BARS[period], totalBars);
    const distance = Math.abs(Math.log(visibleBars / bars));
    if (distance < bestDistance) {
      best = period;
      bestDistance = distance;
    }
  }
  return best;
}

// C-a·C-c 기간 버튼. 한 줄에 다 들어가게 6개만 둔다. 더 긴 범위는 핀치로 본다(D-102).
export const CHART_PERIODS = ['2M', '4M', '6M', '8M', '10M', '12M'] as const;
export type ChartPeriod = (typeof CHART_PERIODS)[number];
export const DEFAULT_PERIOD: ChartPeriod = '6M';

// 기간 버튼이 보여 주는 거래일 봉 수(월 21일로 어림한다)
export const PERIOD_BARS: Record<ChartPeriod, number> = {
  '2M': 42,
  '4M': 84,
  '6M': 126,
  '8M': 168,
  '10M': 210,
  '12M': 252,
};

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

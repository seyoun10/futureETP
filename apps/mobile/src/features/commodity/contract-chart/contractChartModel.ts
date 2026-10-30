// C-c 응답 → LinesChart 입력(선 색, 끝값 라벨, y 자동 맞춤 범위). 순수 함수다.
import type { ContractsChart } from '@futureetp/shared';
import { MAX_CHART_BARS } from '@/charts/chartPeriods';
import type { ChartLine } from '@/charts/LineLayer';
import type { PriceLabel } from '@/charts/YAxisLayer';
import { formatContractMonth, formatPrice } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';

const LINE_STROKE = 1.5;

export type ContractChartModel = {
  lines: ChartLine[];
  // 날짜마다 그날 값이 있는 선들의 위·아래 끝
  envelope: { hi: number[]; lo: number[] };
  // 선마다 가장 긴 값의 라벨. 이동해도 우측 라벨 자리가 바뀌지 않게 너비만 잰다
  widestLabels: PriceLabel[];
};

const lineColor = (index: number) =>
  colors.chart.contractLines[Math.min(index, colors.chart.contractLines.length - 1)];

function lastValue(values: readonly (number | null)[], i0: number, i1: number): number | null {
  for (let i = Math.min(i1, values.length - 1); i >= Math.max(i0, 0); i--) {
    const v = values[i];
    if (v !== null) return v;
  }
  return null;
}

// 최근 MAX_CHART_BARS 거래일만 남긴다(날짜와 월물별 가격을 같은 범위로 자른다)
export function recentContracts(chart: ContractsChart): ContractsChart {
  if (chart.dates.length <= MAX_CHART_BARS) return chart;
  return {
    ...chart,
    dates: chart.dates.slice(-MAX_CHART_BARS),
    contracts: chart.contracts.map((c) => ({ ...c, prices: c.prices.slice(-MAX_CHART_BARS) })),
  };
}

export function contractChartModel(chart: ContractsChart): ContractChartModel {
  const lines = chart.contracts.map((c, i) => ({
    key: c.symbol,
    values: c.prices,
    color: lineColor(i),
    strokeWidth: LINE_STROKE,
  }));
  const hi = chart.dates.map(() => -Infinity);
  const lo = chart.dates.map(() => Infinity);
  for (const c of chart.contracts) {
    c.prices.forEach((v, i) => {
      if (v === null) return;
      if (v > hi[i]) hi[i] = v;
      if (v < lo[i]) lo[i] = v;
    });
  }
  const widestLabels = chart.contracts.flatMap((c, i) => {
    const values = c.prices.filter((v) => v !== null);
    if (values.length === 0) return [];
    const text = (v: number) => formatPrice(v, chart.priceDecimals).length;
    const [min, max] = [Math.min(...values), Math.max(...values)];
    return [label(chart, i, text(min) > text(max) ? min : max)];
  });
  return { lines, envelope: { hi, lo }, widestLabels };
}

const label = (chart: ContractsChart, i: number, price: number): PriceLabel => ({
  key: chart.contracts[i].symbol,
  price,
  color: lineColor(i),
  suffix: formatContractMonth(chart.contracts[i].contractMonth),
});

// 보이는 범위 [i0, i1]에서 각 선의 마지막 값에 월물명을 붙인다(범례 역할, screens.md C-c, D-093).
// 범위 안에 값이 없는 선은 보이지 않으므로 라벨도 없다
export function visibleEndLabels(chart: ContractsChart, i0: number, i1: number): PriceLabel[] {
  return chart.contracts.flatMap((c, i) => {
    const price = lastValue(c.prices, i0, i1);
    return price === null ? [] : [label(chart, i, price)];
  });
}

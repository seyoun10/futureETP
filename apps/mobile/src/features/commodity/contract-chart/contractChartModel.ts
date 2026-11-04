// C-c 응답 → LinesChart 입력(선 색, 끝값 라벨, y 자동 맞춤 범위)과 범례·롤 수익률. 순수 함수다.
import type { ContractsChart } from '@futureetp/shared';
import type { ChartLine } from '@/charts/LineLayer';
import type { PriceLabel } from '@/charts/YAxisLayer';
import { formatContractMonth, formatPrice } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';

const LINE_STROKE = 1;

export type ContractChartModel = {
  lines: ChartLine[];
  // 날짜마다 그날 값이 있는 선들의 위·아래 끝
  envelope: { hi: number[]; lo: number[] };
  // 선마다 가장 긴 값의 라벨. 이동해도 우측 라벨 자리가 바뀌지 않게 너비만 잰다
  widestLabels: PriceLabel[];
  // 차트 위 선 색 범례(만기순). 대표월물은 A처럼 ● 표식
  legend: { key: string; color: string; label: string; isFront: boolean }[];
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
  const legend = chart.contracts.map((c, i) => ({
    key: c.symbol,
    color: lineColor(i),
    label: formatContractMonth(c.contractMonth),
    isFront: c.isFront,
  }));
  return { lines, envelope: { hi, lo }, widestLabels, legend };
}

// 대표월물 표식(A 원자재 목록과 같다)
export const FRONT_MARK = '●';

const label = (chart: ContractsChart, i: number, price: number): PriceLabel => ({
  key: chart.contracts[i].symbol,
  price,
  color: lineColor(i),
});

// 보이는 범위 [i0, i1]에서 각 선의 마지막 값(D-093). 월물은 차트 위 범례 색으로 구분한다.
// 범위 안에 값이 없는 선은 보이지 않으므로 라벨도 없다
export function visibleEndLabels(chart: ContractsChart, i0: number, i1: number): PriceLabel[] {
  return chart.contracts.flatMap((c, i) => {
    const price = lastValue(c.prices, i0, i1);
    return price === null ? [] : [label(chart, i, price)];
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

// 그날 양끝 월물(값이 있는 가장 가까운·먼 만기)의 연환산 롤 수익률(%).
// (near / far − 1) × 365 / 두 최종 거래일 사이 일수 × 100. 양수 = 백워데이션(롤 이익). C-b의 M1→M2 롤 수익률과
// 같은 식이다. 값이 있는 월물이 둘 미만이거나 값이 0 이하이거나 최종 거래일이 같으면 null
export function endsRollYieldPct(chart: ContractsChart, index: number): number | null {
  const priced = chart.contracts
    .map((c) => ({ price: c.prices[index], lastTradeDate: c.lastTradeDate }))
    .filter((c): c is { price: number; lastTradeDate: string } => c.price != null)
    .sort((a, b) => a.lastTradeDate.localeCompare(b.lastTradeDate));
  const near = priced[0];
  const far = priced[priced.length - 1];
  if (priced.length < 2 || near.price <= 0 || far.price <= 0) return null;
  const days = (Date.parse(far.lastTradeDate) - Date.parse(near.lastTradeDate)) / DAY_MS;
  if (days <= 0) return null;
  return (((near.price / far.price - 1) * 365) / days) * 100;
}

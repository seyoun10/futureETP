// C-c 응답 → LinesChart 입력(선 색, 끝값 라벨, y 자동 맞춤 범위). 순수 함수다.
import type { ContractsChart } from '@futureetp/shared';
import type { ChartLine } from '@/charts/LineLayer';
import type { PriceLabel } from '@/charts/YAxisLayer';
import { formatContractMonth } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';

const LINE_STROKE = 1.5;

export type ContractChartModel = {
  lines: ChartLine[];
  // 날짜마다 그날 값이 있는 선들의 위·아래 끝
  envelope: { hi: number[]; lo: number[] };
  // 각 선의 끝값. 라벨이 범례를 대신해 월물명을 붙인다(screens.md C-c)
  endLabels: PriceLabel[];
};

const lineColor = (index: number) =>
  colors.chart.contractLines[Math.min(index, colors.chart.contractLines.length - 1)];

function lastValue(values: readonly (number | null)[]): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
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
  const endLabels = chart.contracts.flatMap((c, i) => {
    const price = lastValue(c.prices);
    return price === null
      ? []
      : [
          {
            key: c.symbol,
            price,
            color: lineColor(i),
            suffix: formatContractMonth(c.contractMonth),
          },
        ];
  });
  return { lines, envelope: { hi, lo }, endLabels };
}

// C-a 응답 → CandleChart 입력(선 색·굵기, y축 특수 라벨 색, 롤 표시). 순수 함수다.
import type { DisparityChart } from '@futureetp/shared';
import type { ChartLine } from '@/charts/LineLayer';
import type { RollMarks } from '@/charts/RollLayer';
import type { PriceLabel } from '@/charts/YAxisLayer';
import { formatContractMonth } from '@/lib/formatNumber';
import { colors } from '@/theme/tokens';
import {
  bandLines,
  chartBars,
  chartEnvelope,
  frontSwitches,
  rollSegments,
  specialLabels,
} from './disparitySeries';
import type { ChartBar } from './disparitySeries';

const MA_STROKE = 2.5;
const BAND_STROKE = 1;

export type DisparityChartModel = {
  bars: ChartBar[];
  envelope: { hi: number[]; lo: number[] };
  lines: ChartLine[];
  priceLabels: PriceLabel[];
  roll: RollMarks;
  // 대표월물 전환 마커 봉 순번 → 새 월물명(십자선 상세용)
  frontSwitchAt: ReadonlyMap<number, string>;
};

const bandColor = (rank: number) =>
  colors.chart.rareLevels[Math.min(rank, colors.chart.rareLevels.length - 1)];

export function disparityChartModel(chart: DisparityChart): DisparityChartModel {
  const bars = chartBars(chart.bars);
  const bands = bandLines(bars, chart.rareLevels);
  const colorByKey = new Map(bands.map((b) => [b.key, bandColor(b.rank)]));
  // 이평선을 마지막에 그려 밴드 위에 오게 한다
  const lines: ChartLine[] = [
    ...bands.map((b) => ({
      key: b.key,
      values: b.values,
      color: bandColor(b.rank),
      strokeWidth: BAND_STROKE,
    })),
    {
      key: 'ma',
      values: bars.map((b) => b.ma),
      color: colors.chart.movingAverage,
      strokeWidth: MA_STROKE,
    },
  ];
  const priceLabels = specialLabels(bars, bands).map((label) => ({
    key: label.key,
    price: label.price,
    color:
      label.kind === 'current'
        ? colors.chart.currentPrice
        : label.kind === 'ma'
          ? colors.chart.movingAverage
          : (colorByKey.get(label.key) ?? colors.chart.tick),
  }));
  // 실제로 그린 기준값의 롤 정보만: 대표월물은 전환 마커, 한국형·미국형은 음영(screens.md C-a 롤 표시)
  // 마커 라벨은 겹치지 않게 새 월물의 월 번호만 쓰고, 전체 월물명은 십자선 상세에서 보여 준다
  const switches = chart.basis === 'FRONT' ? frontSwitches(bars) : [];
  const roll: RollMarks =
    chart.basis === 'FRONT'
      ? {
          shading: [],
          markers: switches.map((s) => ({
            index: s.index,
            label: String(Number(s.contractMonth.slice(5, 7))),
          })),
        }
      : { shading: rollSegments(bars), markers: [] };
  const frontSwitchAt = new Map(
    switches.map((s) => [s.index, formatContractMonth(s.contractMonth)] as const),
  );

  return { bars, envelope: chartEnvelope(bars, bands), lines, priceLabels, roll, frontSwitchAt };
}

// 십자선 상세의 월물 구성: 대표월물은 월물명, 한국형·미국형은 `DEC26 60% · JAN27 40%`
export function holdingsText(bar: ChartBar, basis: DisparityChart['basis']): string | null {
  if (bar.holdings.length === 0) return null;
  if (basis === 'FRONT') return formatContractMonth(bar.holdings[0].contractMonth);
  return bar.holdings
    .map((h) => `${formatContractMonth(h.contractMonth)} ${Math.round(h.weight * 100)}%`)
    .join(' · ');
}

// 꼬리 백분위 표시값. 1% 미만은 소수 첫째 자리까지 보여 0%로 뭉개지지 않게 한다
export const formatTailPct = (pct: number): string =>
  pct < 1 ? pct.toFixed(1) : String(Math.round(pct));

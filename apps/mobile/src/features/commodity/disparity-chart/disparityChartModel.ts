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
} from './disparitySeries';
import type { ChartBar } from './disparitySeries';

const MA_STROKE = 2.5;
const BAND_STROKE = 1;

// 십자선 상세에 쓰는 선 이름: 이평선, 또는 rare-level 방향·레벨
export type LineLabel =
  | { kind: 'ma' }
  | { kind: 'band'; direction: DisparityChart['rareLevels'][number]['direction']; level: number };

export type DisparityChartModel = {
  bars: ChartBar[];
  envelope: { hi: number[]; lo: number[] };
  lines: (ChartLine & { label: LineLabel })[];
  roll: RollMarks;
  // 대표월물 전환일 봉 순번 → 새 월물명(십자선 상세용)
  frontSwitchAt: ReadonlyMap<number, string>;
};

const bandColor = (rank: number) =>
  colors.chart.rareLevels[Math.min(rank, colors.chart.rareLevels.length - 1)];

export function disparityChartModel(chart: DisparityChart): DisparityChartModel {
  const bars = chartBars(chart.bars);
  const bands = bandLines(bars, chart.rareLevels);
  // 이평선을 마지막에 그려 밴드 위에 오게 한다
  const lines: DisparityChartModel['lines'] = [
    ...bands.map((b) => ({
      key: b.key,
      values: b.values,
      color: bandColor(b.rank),
      strokeWidth: BAND_STROKE,
      label: { kind: 'band' as const, direction: b.direction, level: b.level },
    })),
    {
      key: 'ma',
      values: bars.map((b) => b.ma),
      color: colors.chart.movingAverage,
      strokeWidth: MA_STROKE,
      label: { kind: 'ma' },
    },
  ];
  // 실제로 그린 기준값의 롤 정보만: 한국형·미국형은 음영, 대표월물은 전환일 세로 점선(screens.md C-a 롤 표시).
  // 전환일의 새 월물명은 십자선 상세에서 보여 준다
  const switches = chart.basis === 'FRONT' ? frontSwitches(bars) : [];
  const roll: RollMarks =
    chart.basis === 'FRONT'
      ? { shading: [], switches: switches.map((s) => s.index) }
      : { shading: rollSegments(bars), switches: [] };
  const frontSwitchAt = new Map(
    switches.map((s) => [s.index, formatContractMonth(s.contractMonth)] as const),
  );

  return { bars, envelope: chartEnvelope(bars, bands), lines, roll, frontSwitchAt };
}

// y축 특수 라벨: 마지막 봉 종가(흰색), 봉 index(보이는 마지막 봉)의 종가(회색)와 이평선·rare-level 값(선 색).
// 보이는 마지막 봉이 마지막 봉이면 종가는 흰색 하나만. 겹치면 모두 남긴 채 위·아래로 민다(screens.md C-a y축 라벨)
export function priceLabelsAt(model: DisparityChartModel, index: number): PriceLabel[] {
  const bar = model.bars[index];
  const last = model.bars[model.bars.length - 1];
  if (!bar) return [];
  return [
    { key: 'last', price: last.close, color: colors.chart.lastPrice },
    ...(bar === last
      ? []
      : [{ key: 'current', price: bar.close, color: colors.chart.currentPrice }]),
    ...model.lines.flatMap((line): PriceLabel[] => {
      const price = line.values[index];
      return price === null || price === undefined
        ? []
        : [{ key: line.key, price, color: line.color }];
    }),
  ];
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

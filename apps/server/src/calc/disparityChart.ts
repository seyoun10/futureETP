// C-a 이격도차트 응답의 봉·rare-level·꼬리 백분위를 조립한다(product.md 이격도차트, D-086).
import type { CommodityCode, DisparityBar, RareLevelLine } from '@futureetp/shared';
import { DIRECTIONS } from '@futureetp/shared';
import {
  liveDisparity,
  liveMovingAverage,
  rareLevelDisparity,
  rareLevelPrice,
  tailPercentile,
} from './disparity.ts';
import { isRollPeriodDay } from './rollWeight.ts';
import type { RollRuleParams } from './rollWeight.ts';

// index_bar 한 행(맞춤 전 원래 지수)
export type StoredIndexBar = {
  tradeDate: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  inRollPeriod: boolean;
};

// disparity 한 행(그 이평선 기간). 산출 불가일은 행이 없다
export type StoredDisparity = { tradeDate: string; ma: number | null; disparity: number | null };

// roll_weight 한 행(그날 종가 뒤 비중)과 월물의 YYYY-MM
export type StoredWeight = { tradeDate: string; contractMonth: string; weight: number };

// index_snapshot 중 그 거래일의 최근 행(맞춤 전 원래 지수)
export type StoredIndexSnapshot = {
  tradeDate: string;
  capturedAt: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  last: number | null;
};

export type DisparityChartInput = {
  maPeriod: number;
  // 오름차순 rare 레벨 p
  levels: readonly number[];
  // 거래일 오름차순
  bars: readonly StoredIndexBar[];
  disparities: readonly StoredDisparity[];
  weights: readonly StoredWeight[];
  // index_scale.ratio. 없으면 봉을 내지 않는다
  ratio: number | null;
  snapshot: StoredIndexSnapshot | null;
  // 한국형·미국형 롤 규칙(잠정 봉의 롤 구간 판정). 대표월물은 null
  rule: { commodityCode: CommodityCode; params: RollRuleParams } | null;
  // 오름차순 이격도 분포. 없으면 null
  sortedValues: readonly number[] | null;
};

export type DisparityChartResult = {
  bars: DisparityBar[];
  rareLevels: RareLevelLine[];
  currentTail: { side: (typeof DIRECTIONS)[number]; pct: number } | null;
  provisional: boolean;
};

const scale = (value: number | null, ratio: number) => (value === null ? null : value * ratio);

// 봉 t의 보유 월물은 직전 거래일 종가 뒤 비중이다(지수 수익률이 w(t−1)을 쓰는 것과 같다, D-066)
function holdingsByDate(weights: readonly StoredWeight[]) {
  const byDate = new Map<string, { contractMonth: string; weight: number }[]>();
  for (const { tradeDate, contractMonth, weight } of weights) {
    const list = byDate.get(tradeDate) ?? [];
    list.push({ contractMonth, weight });
    byDate.set(tradeDate, list);
  }
  for (const list of byDate.values())
    list.sort((a, b) => a.contractMonth.localeCompare(b.contractMonth));
  return (prevTradeDate: string | undefined) =>
    (prevTradeDate === undefined ? undefined : byDate.get(prevTradeDate)) ?? [];
}

export function buildDisparityChart(input: DisparityChartInput): DisparityChartResult {
  const { ratio } = input;
  if (ratio === null || input.bars.length === 0) {
    return { bars: [], rareLevels: [], currentTail: null, provisional: false };
  }
  const disparityByDate = new Map(input.disparities.map((d) => [d.tradeDate, d]));
  const holdings = holdingsByDate(input.weights);

  const bars: DisparityBar[] = input.bars.map((bar, i) => {
    const d = disparityByDate.get(bar.tradeDate);
    return {
      tradeDate: bar.tradeDate,
      open: scale(bar.open, ratio),
      high: scale(bar.high, ratio),
      low: scale(bar.low, ratio),
      close: scale(bar.close, ratio),
      ma: scale(d?.ma ?? null, ratio),
      disparity: d?.disparity ?? null,
      inRoll: bar.inRollPeriod,
      holdings: holdings(input.bars[i - 1]?.tradeDate),
    };
  });

  // 오늘 잠정 봉: 저장된 마지막 봉 뒤 거래일의 스냅숏. 이평선·이격도는 직전 유효 종가로 그 자리에서 만든다
  const lastStored = input.bars[input.bars.length - 1];
  const { snapshot } = input;
  const provisional =
    snapshot !== null && snapshot.last !== null && snapshot.tradeDate > lastStored.tradeDate;
  if (provisional) {
    const last = snapshot.last as number;
    const prevCloses = input.bars.flatMap((b) => (b.close === null ? [] : [b.close]));
    const today = holdings(lastStored.tradeDate);
    bars.push({
      tradeDate: snapshot.tradeDate,
      open: scale(snapshot.open, ratio),
      high: scale(snapshot.high, ratio),
      low: scale(snapshot.low, ratio),
      close: last * ratio,
      ma: scale(liveMovingAverage(prevCloses, last, input.maPeriod), ratio),
      disparity: liveDisparity(prevCloses, last, input.maPeriod),
      // 저장된 봉처럼 그날 종가에 비중이 옮겨지는 영업일인지 규칙으로 정한다(보유 월물 수로는 롤 첫날을 놓치고
      // 여러 leg 규칙은 늘 둘 이상이다). 대표월물 전환은 그날 거래량으로 정해져 장중에는 모른다
      inRoll:
        input.rule !== null &&
        isRollPeriodDay(input.rule.commodityCode, input.rule.params, snapshot.tradeDate, [
          ...input.bars.map((b) => b.tradeDate),
          snapshot.tradeDate,
        ]),
      holdings: today,
    });
  }

  const current = bars[bars.length - 1];
  const sorted = input.sortedValues;
  const rareLevels: RareLevelLine[] =
    sorted === null || sorted.length === 0
      ? []
      : DIRECTIONS.flatMap((direction) =>
          input.levels.map((level) => {
            const disparity = rareLevelDisparity(sorted, direction, level);
            return {
              direction,
              level,
              disparity,
              price: current.ma === null ? null : rareLevelPrice(current.ma, disparity),
            };
          }),
        );
  const currentTail =
    sorted === null || sorted.length === 0 || current.disparity === null
      ? null
      : tailPercentile(sorted, current.disparity);

  return { bars, rareLevels, currentTail, provisional };
}

// 응답 크기용 반올림(실측: CL 봉 4,125개 gzip 264KB → 125KB). 가격은 표시 자릿수보다 2자리 더,
// 이격도·백분위(%)는 3자리. 꼬리 백분위·rare-level은 반올림 전 값으로 이미 계산했다
const DISPARITY_DECIMALS = 3;
const PRICE_EXTRA_DECIMALS = 2;

const roundTo = (value: number, decimals: number) => Number(value.toFixed(decimals));
const roundOrNull = (value: number | null, decimals: number) =>
  value === null ? null : roundTo(value, decimals);

export function roundDisparityChart(
  chart: DisparityChartResult,
  priceDecimals: number,
): DisparityChartResult {
  const p = priceDecimals + PRICE_EXTRA_DECIMALS;
  return {
    ...chart,
    bars: chart.bars.map((bar) => ({
      ...bar,
      open: roundOrNull(bar.open, p),
      high: roundOrNull(bar.high, p),
      low: roundOrNull(bar.low, p),
      close: roundOrNull(bar.close, p),
      ma: roundOrNull(bar.ma, p),
      disparity: roundOrNull(bar.disparity, DISPARITY_DECIMALS),
    })),
    rareLevels: chart.rareLevels.map((line) => ({
      ...line,
      disparity: roundTo(line.disparity, DISPARITY_DECIMALS),
      price: roundOrNull(line.price, p),
    })),
    currentTail:
      chart.currentTail === null
        ? null
        : { ...chart.currentTail, pct: roundTo(chart.currentTail.pct, DISPARITY_DECIMALS) },
  };
}

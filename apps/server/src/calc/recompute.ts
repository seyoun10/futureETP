// 원자재·기준값 하나의 계산 결과(roll_weight → index_bar·index_scale → disparity·disparity_distribution)를
// 원천값(daily_bar)에서 처음부터 만든다. 일일 정산과 규칙 변경(D-024)이 같은 함수를 쓴다(D-070).
import {
  MA_PERIODS,
  WINDOWS,
  type CommodityCode,
  type MaPeriod,
  type Window,
} from '@futureetp/shared';
import {
  buildDisparitySeries,
  buildDistribution,
  type DisparityRow,
  type Distribution,
} from './disparity.ts';
import { buildFrontAfterClose } from './frontMonth.ts';
import {
  buildIndexBars,
  indexScaleRatio,
  type DayBar,
  type HeldWeights,
  type IndexBarRow,
} from './indexChain.ts';
import type { ListedContract } from './monthList.ts';
import { expandRollWeights, type RollRuleParams } from './rollWeight.ts';

// daily_bar 행
export type SourceBar = DayBar & {
  contractSymbol: string;
  tradeDate: string;
  volume: number;
};

export type RecomputeInput = {
  commodityCode: CommodityCode;
  // 한국형·미국형 roll_rule.params. null = 대표월물(FRONT)
  rule: RollRuleParams | null;
  contracts: readonly ListedContract[];
  // trading_day 날짜(오름차순). 일봉 첫날~마지막 날 구간만 쓴다
  tradeDates: readonly string[];
  bars: readonly SourceBar[];
};

export type RollWeightRow = { tradeDate: string; contractSymbol: string; weight: number };

export type RecomputeResult = {
  rollWeights: RollWeightRow[];
  indexBars: IndexBarRow[];
  // 유효일이 없으면 null(index_scale 행 없음)
  scaleRatio: number | null;
  disparities: { maPeriod: MaPeriod; rows: DisparityRow[] }[];
  // 기준 거래일 = 마지막 거래일. 표본이 없는 조합은 뺀다
  distributions: (Distribution & { maPeriod: MaPeriod; window: Window })[];
};

type Day = { tradeDate: string; bars: Map<string, DayBar>; volumes: Map<string, number> };

// 일봉을 거래일별로 묶는다. 거래일 달력에 없는 날의 일봉은 달력 누락이라 오류다
function groupByDay(tradeDates: readonly string[], bars: readonly SourceBar[]): Day[] {
  if (bars.length === 0) return [];
  const known = new Set(tradeDates);
  const byDate = new Map<string, Day>();
  let first = bars[0].tradeDate;
  let last = first;
  for (const { contractSymbol, tradeDate, volume, ...bar } of bars) {
    if (!known.has(tradeDate)) throw new Error(`${tradeDate} 일봉이 있는데 거래일이 아니다`);
    if (tradeDate < first) first = tradeDate;
    if (tradeDate > last) last = tradeDate;
    let day = byDate.get(tradeDate);
    if (!day) {
      day = { tradeDate, bars: new Map(), volumes: new Map() };
      byDate.set(tradeDate, day);
    }
    day.bars.set(contractSymbol, bar);
    day.volumes.set(contractSymbol, volume);
  }
  // 일봉이 하나도 없는 거래일도 넣어 둔다(영업일 순번을 세고, 비중이 있으면 정산가 없음 오류가 난다)
  return [...tradeDates]
    .filter((d) => d >= first && d <= last)
    .sort()
    .map((d) => byDate.get(d) ?? { tradeDate: d, bars: new Map(), volumes: new Map() });
}

type WeightDay = { weights: HeldWeights; inRollPeriod: boolean };

function frontWeights(contracts: readonly ListedContract[], days: readonly Day[]): WeightDay[] {
  // 대표월물은 비중이 바뀌는 종가의 날(전환일)을 롤 구간으로 둔다
  return buildFrontAfterClose(contracts, days).map(({ symbol, switched }) => ({
    weights: symbol === null ? [] : [{ symbol, weight: 1 }],
    inRollPeriod: switched,
  }));
}

function ruleWeights(
  commodityCode: CommodityCode,
  rule: RollRuleParams,
  days: readonly Day[],
): WeightDay[] {
  const prices = days.map(({ tradeDate, bars }) => ({
    tradeDate,
    prices: new Map([...bars].map(([symbol, bar]) => [symbol, bar.settle])),
  }));
  return expandRollWeights(commodityCode, rule, prices);
}

export function recomputeBasis(input: RecomputeInput): RecomputeResult {
  const days = groupByDay(input.tradeDates, input.bars);
  const weightDays =
    input.rule === null
      ? frontWeights(input.contracts, days)
      : ruleWeights(input.commodityCode, input.rule, days);

  const indexBars = buildIndexBars(
    days.map((day, i) => ({ tradeDate: day.tradeDate, bars: day.bars, ...weightDays[i] })),
  );
  const closes = indexBars.map(({ tradeDate, close }) => ({ tradeDate, close }));
  const disparities = MA_PERIODS.map((maPeriod) => ({
    maPeriod,
    rows: buildDisparitySeries(closes, maPeriod),
  }));

  const asOf = days.at(-1)?.tradeDate;
  const distributions: RecomputeResult['distributions'] = [];
  if (asOf !== undefined) {
    for (const { maPeriod, rows } of disparities) {
      for (const window of WINDOWS) {
        const dist = buildDistribution(rows, asOf, window);
        if (dist) distributions.push({ maPeriod, window, ...dist });
      }
    }
  }

  return {
    rollWeights: days.flatMap(({ tradeDate }, i) =>
      weightDays[i].weights.map(({ symbol, weight }) => ({
        tradeDate,
        contractSymbol: symbol,
        weight,
      })),
    ),
    indexBars,
    scaleRatio: indexScaleRatio(indexBars),
    disparities,
    distributions,
  };
}

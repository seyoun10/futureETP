// 대표월물 선택과 전환(product.md 계산 정의 > 기준값 > 대표월물, D-004, D-064).

import type { ListedContract } from './monthList.ts';

// 월물별 그 거래일 거래량(daily_bar.volume). 없는 월물은 0으로 본다.
export type DayVolumes = ReadonlyMap<string, number>;

export type FrontDay = {
  tradeDate: string;
  volumes: DayVolumes;
};

const volumeOf = (volumes: DayVolumes, symbol: string) => volumes.get(symbol) ?? 0;

const byExpiry = (a: ListedContract, b: ListedContract) =>
  a.lastTradeDate.localeCompare(b.lastTradeDate) || a.contractMonth.localeCompare(b.contractMonth);

// 거래량이 가장 많은 월물. 같으면 만기가 가까운 쪽
function mostTraded<T extends ListedContract>(sorted: readonly T[], volumes: DayVolumes) {
  let best: T | undefined;
  for (const c of sorted) {
    if (best === undefined || volumeOf(volumes, c.symbol) > volumeOf(volumes, best.symbol))
      best = c;
  }
  return best;
}

// 적재 첫 거래일처럼 이전 대표월물이 없을 때: 그날 만기되지 않은 대상 월물 중 그날 거래량이 가장 많은 월물.
// 후보가 없으면 null
export function initialFrontSymbol(
  contracts: readonly ListedContract[],
  tradeDate: string,
  volumes: DayVolumes,
): string | null {
  const candidates = contracts
    .filter((c) => c.isTarget && c.lastTradeDate >= tradeDate)
    .sort(byExpiry);
  return mostTraded(candidates, volumes)?.symbol ?? null;
}

// tradeDate(정산이 끝난 거래일)의 거래량으로 다음 거래일의 대표월물을 정한다.
// - 현재보다 만기가 늦고 다음 거래일에도 거래되는 대상 월물 중 거래량이 현재를 넘는 것이 있으면
//   그중 가장 많은 월물로 옮긴다. 이전 월물로는 되돌아가지 않는다.
// - 안전장치: 현재 월물이 tradeDate에 최종 거래일에 도달했으면 현재 거래량과 비교하지 않고
//   후보 중 거래량이 가장 많은 월물로 옮긴다(모두 0이면 만기순 다음). 후보가 없으면 null(월물 상장 누락)
export function nextFrontSymbol(
  contracts: readonly ListedContract[],
  tradeDate: string,
  volumes: DayVolumes,
  currentSymbol: string,
): string | null {
  const current = contracts.find((c) => c.symbol === currentSymbol);
  if (!current) throw new Error(`대표월물 ${currentSymbol}이 월물 목록에 없다`);

  const later = contracts
    .filter((c) => c.isTarget && byExpiry(c, current) > 0 && c.lastTradeDate > tradeDate)
    .sort(byExpiry);
  const best = mostTraded(later, volumes);
  if (current.lastTradeDate <= tradeDate) return best?.symbol ?? null;
  if (best && volumeOf(volumes, best.symbol) > volumeOf(volumes, currentSymbol)) return best.symbol;
  return currentSymbol;
}

// 거래일 순서(오름차순)의 거래량으로 날짜별 대표월물을 만든다(전체 재계산용).
// 첫날과 직전 대표월물이 null인 날은 initialFrontSymbol, 나머지는 전일의 nextFrontSymbol이다.
export function buildFrontSeries(
  contracts: readonly ListedContract[],
  days: readonly FrontDay[],
): { tradeDate: string; symbol: string | null }[] {
  const series: { tradeDate: string; symbol: string | null }[] = [];
  let prev: (FrontDay & { symbol: string | null }) | undefined;
  for (const day of days) {
    const symbol =
      prev?.symbol != null
        ? nextFrontSymbol(contracts, prev.tradeDate, prev.volumes, prev.symbol)
        : initialFrontSymbol(contracts, day.tradeDate, day.volumes);
    series.push({ tradeDate: day.tradeDate, symbol });
    prev = { ...day, symbol };
  }
  return series;
}

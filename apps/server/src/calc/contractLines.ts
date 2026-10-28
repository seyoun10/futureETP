// 월물차트(C-c): 월물별 원가격 선을 날짜 축 하나에 맞춘다(product.md 월물차트, D-048, D-092).

import type { ListedContract } from './monthList.ts';
import type { QuoteBar, QuoteSnapshot } from './quotes.ts';

export type ContractLinesInput = {
  // 그릴 월물(selectMonthList 결과, 순서 유지)
  contracts: readonly ListedContract[];
  // 표시 데이터가 속한 거래일(marketStatus.tradeDate)
  tradeDate: string;
  // 그릴 월물의 tradeDate 이하 일봉 전체
  bars: readonly QuoteBar[];
  // 월물별 tradeDate 최근 스냅숏
  snapshots: readonly QuoteSnapshot[];
};

export type ContractLinesResult = {
  // 오름차순
  dates: string[];
  lines: { symbol: string; contractMonth: string; prices: (number | null)[] }[];
  // tradeDate 값에 스냅숏을 하나라도 썼는지(잠정 값·지연 시세)
  provisional: boolean;
  // 각 선 마지막 값 시각 중 가장 늦은 시각. 값이 하나도 없으면 null
  asOf: Date | null;
};

// 날짜는 그릴 월물 중 하나라도 일봉이 있는 날이다. 상장 전·일봉이 빠진 날은 null이다.
// tradeDate 값은 그날 정산가 → 최근 스냅숏 순이다(D-048). 정산가가 없는 월물만 스냅숏을 쓴다.
export function buildContractLines(input: ContractLinesInput): ContractLinesResult {
  const symbols = new Set(input.contracts.map((c) => c.symbol));
  const bars = input.bars.filter(
    (b) => symbols.has(b.contractSymbol) && b.tradeDate <= input.tradeDate,
  );
  const settled = new Map(bars.map((b) => [`${b.contractSymbol} ${b.tradeDate}`, b]));
  const snapshots = input.snapshots.filter(
    (s) => symbols.has(s.contractSymbol) && !settled.has(`${s.contractSymbol} ${input.tradeDate}`),
  );
  const dateSet = new Set(bars.map((b) => b.tradeDate));
  if (snapshots.length > 0) dateSet.add(input.tradeDate);
  const dates = [...dateSet].sort();

  let asOf: number | null = null;
  const lines = input.contracts.map((c) => {
    const snapshot = snapshots.find((s) => s.contractSymbol === c.symbol);
    let last: Date | null = null;
    const prices: (number | null)[] = [];
    for (const date of dates) {
      const bar = settled.get(`${c.symbol} ${date}`);
      if (bar) {
        last = bar.revisedAt ?? bar.collectedAt;
        prices.push(bar.settle);
      } else if (date === input.tradeDate && snapshot) {
        last = snapshot.capturedAt;
        prices.push(snapshot.last);
      } else {
        prices.push(null);
      }
    }
    if (last !== null) asOf = Math.max(asOf ?? 0, last.getTime());
    return { symbol: c.symbol, contractMonth: c.contractMonth, prices };
  });

  return {
    dates,
    lines,
    provisional: snapshots.length > 0,
    asOf: asOf === null ? null : new Date(asOf),
  };
}

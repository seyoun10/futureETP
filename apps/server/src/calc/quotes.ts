// 홈(A) 월물 한 줄의 표시 값(product.md 월물 목록, D-048, D-085).
import type { ContractQuote } from '@futureetp/shared';
import type { ListedContract } from './monthList.ts';

export type QuoteBar = {
  contractSymbol: string;
  tradeDate: string;
  settle: number;
  collectedAt: Date;
  revisedAt: Date | null;
};

// 월물별 그 거래일 최근 장중 스냅숏
export type QuoteSnapshot = { contractSymbol: string; capturedAt: Date; last: number };

export type QuoteInput = {
  contracts: readonly ListedContract[];
  frontSymbol: string | null;
  // 표시 데이터가 속한 거래일(marketStatus.tradeDate)과 그 직전 거래일
  tradeDate: string;
  prevTradeDate: string | null;
  bars: readonly QuoteBar[];
  snapshots: readonly QuoteSnapshot[];
};

export type QuoteResult = {
  quotes: ContractQuote[];
  // 표시한 값 중 가장 늦은 시각. 값이 하나도 없으면 null
  asOf: Date | null;
  // 장중 스냅숏(지연 시세)을 하나라도 썼는지
  delayed: boolean;
};

// 값은 그 거래일 정산가 → 최근 스냅숏 → 직전 거래일 정산가(거래 없음) 순으로 고른다.
// 장 상태로 나누지 않는다. 장중에는 그날 정산가가 없고, 마감 뒤 정산 전에는 그날 마지막 스냅숏이 남는다(D-048).
export function buildQuotes(input: QuoteInput): QuoteResult {
  const bar = (symbol: string, date: string | null) =>
    input.bars.find((b) => b.contractSymbol === symbol && b.tradeDate === date);
  let asOf: number | null = null;
  let delayed = false;
  const seen = (time: Date) => {
    asOf = Math.max(asOf ?? 0, time.getTime());
  };

  const quotes = input.contracts.map((c): ContractQuote => {
    const prev = bar(c.symbol, input.prevTradeDate);
    const settled = bar(c.symbol, input.tradeDate);
    const snapshot = input.snapshots.find((s) => s.contractSymbol === c.symbol);
    let price: number | null = null;
    let noTrade = false;
    if (settled) {
      price = settled.settle;
      seen(settled.revisedAt ?? settled.collectedAt);
    } else if (snapshot) {
      price = snapshot.last;
      seen(snapshot.capturedAt);
      delayed = true;
    } else {
      noTrade = true;
      if (prev) {
        price = prev.settle;
        seen(prev.revisedAt ?? prev.collectedAt);
      }
    }
    const change = !noTrade && price !== null && prev ? price - prev.settle : null;
    return {
      symbol: c.symbol,
      contractMonth: c.contractMonth,
      price,
      change,
      changePct: change !== null && prev ? (change / prev.settle) * 100 : null,
      noTrade,
      isFront: c.symbol === input.frontSymbol,
    };
  });

  return { quotes, asOf: asOf === null ? null : new Date(asOf), delayed };
}

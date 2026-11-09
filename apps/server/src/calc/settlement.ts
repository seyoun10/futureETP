// 일일 정산 대상 거래일과 정정 판정(D-047, D-071). DB·소스 접근은 jobs/settle.ts가 한다.
import { lastClosedTradeDate, type TradingDaySession } from './marketState.ts';

// 밀린 거래일을 한 번에 따라잡는 최대 일수. 넘으면 사람이 기준 시각을 주고 나눠 돌린다
export const MAX_CATCH_UP_DAYS = 5;

export type SettlePlan = {
  // 세션이 끝난 가장 최근 거래일(ctx.tradeDate)
  tradeDate: string;
  // 이번에 받을 거래일(오름차순). 이미 정산됐으면 빈 배열
  dates: string[];
};

// 정산 ①: 마지막 정산 거래일 다음부터 세션이 끝난 가장 최근 거래일까지.
// 정산 이력이 없으면(첫 실행) 가장 최근 거래일만 받는다.
// days는 오름차순 trading_day 행이고 lastSettledTradeDate 이후를 모두 포함해야 한다.
export function planSettle(
  now: Date,
  days: readonly TradingDaySession[],
  lastSettledTradeDate: string | null,
): SettlePlan {
  const tradeDate = lastClosedTradeDate(now, days);
  if (tradeDate === null) throw new Error(`No closed trading day before ${now.toISOString()}`);
  if (lastSettledTradeDate === null) return { tradeDate, dates: [tradeDate] };
  if (lastSettledTradeDate >= tradeDate) return { tradeDate, dates: [] };
  if (days.length === 0 || lastSettledTradeDate < days[0].tradeDate) {
    throw new Error(`Trading days before ${lastSettledTradeDate} are not loaded`);
  }

  const dates = days
    .map((d) => d.tradeDate)
    .filter((d) => d > lastSettledTradeDate && d <= tradeDate);
  if (dates.length > MAX_CATCH_UP_DAYS) {
    throw new Error(
      `${dates.length} unsettled trading days (${dates[0]}..${tradeDate}) exceed ${MAX_CATCH_UP_DAYS}; ` +
        'run DAILY_SETTLE with an earlier as-of time first',
    );
  }
  return { tradeDate, dates };
}

// 정산 ②: 세션이 끝난 가장 최근 거래일의 직전 거래일. 찾지 못하면 null
export function revisionTradeDate(now: Date, days: readonly TradingDaySession[]): string | null {
  const tradeDate = lastClosedTradeDate(now, days);
  const index = days.findIndex((d) => d.tradeDate === tradeDate);
  return index > 0 ? days[index - 1].tradeDate : null;
}

export type BarValues = {
  contractSymbol: string;
  open: number | null;
  high: number | null;
  low: number | null;
  settle: number;
  volume: number;
};

// 저장된 일봉과 다시 받은 일봉을 비교해 값이 바뀐 것(다시 받은 값)만 돌려준다.
// 저장되지 않은 월물과 소스에서 빠진 월물은 정정으로 보지 않는다.
// 소스가 비워 보낸 OHLC·거래량(소스 구현에서 null·0)은 저장된 값을 지우지 않는다(D-110)
export function findRevisedBars<T extends BarValues>(
  stored: readonly BarValues[],
  fetched: readonly T[],
): T[] {
  const bySymbol = new Map(stored.map((b) => [b.contractSymbol, b]));
  return fetched.flatMap((b) => {
    const s = bySymbol.get(b.contractSymbol);
    if (s === undefined) return [];
    const merged = {
      ...b,
      open: b.open ?? s.open,
      high: b.high ?? s.high,
      low: b.low ?? s.low,
      volume: b.volume === 0 ? s.volume : b.volume,
    };
    const changed =
      s.settle !== merged.settle ||
      s.volume !== merged.volume ||
      s.open !== merged.open ||
      s.high !== merged.high ||
      s.low !== merged.low;
    return changed ? [merged] : [];
  });
}

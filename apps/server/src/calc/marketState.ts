// CME 거래일·장 상태 판정(D-022, D-047, D-048, D-062). freshness와 배치가 함께 쓴다.
// 정산 여부는 호출자가 일일 정산 ①이 성공한 가장 최근 거래일(lastSettledTradeDate)로 넘긴다.
import type { MarketState } from '@futureetp/shared';
import { CME_TIME_ZONE, zonedTimeToUtc } from './tradingCalendar.ts';

// trading_day 행. 과거 행(D-048)은 세션 시각이 비어 있어 판정에 쓰지 않는다.
export type TradingDaySession = {
  tradeDate: string;
  sessionOpenAt: Date | null;
  sessionCloseAt: Date | null;
  haltStartAt: Date | null;
  haltEndAt: Date | null;
};

const MINUTE = 60_000;
// 일일 정산 시작 시각(CT). jobs/scheduler.ts TRIGGERS와 같다(D-019).
export const SETTLE_AT = '18:30';
// 일일 정산 ① 예상 소요(D-047)
export const SETTLE_STEP1_EXPECTED_MS = 20 * MINUTE;
// 장중 배치 예상 소요. 실측 전 임시값이다(D-062).
export const INTRADAY_EXPECTED_MS = 5 * MINUTE;
// 장중 배치는 CT :00/:15/:30/:45. CT 오프셋이 정시 단위라 UTC 15분 배수와 같다.
const SLOT_MS = 15 * MINUTE;

export type MarketStatus = {
  state: MarketState;
  // 표시 데이터가 속한 거래일. 정산 대기 중에는 직전 거래일이다(D-022).
  tradeDate: string | null;
  nextUpdateAt: Date | null;
};

type Session = { index: number; tradeDate: string; openAt: Date; closeAt: Date };

function sessions(days: readonly TradingDaySession[]): Session[] {
  return days.flatMap((d, index) =>
    d.sessionOpenAt && d.sessionCloseAt
      ? [{ index, tradeDate: d.tradeDate, openAt: d.sessionOpenAt, closeAt: d.sessionCloseAt }]
      : [],
  );
}

function inHalt(day: TradingDaySession, t: number): boolean {
  return (
    day.haltStartAt !== null &&
    day.haltEndAt !== null &&
    t >= day.haltStartAt.getTime() &&
    t < day.haltEndAt.getTime()
  );
}

// 직전 거래일이 아직 정산되지 않았으면 그 거래일을 돌려준다. 직전 행이 없으면 판단하지 않는다.
function unsettledPrevious(
  days: readonly TradingDaySession[],
  index: number,
  lastSettledTradeDate: string | null,
): string | null {
  const prev = days[index - 1]?.tradeDate;
  if (prev === undefined) return null;
  return lastSettledTradeDate !== null && lastSettledTradeDate >= prev ? null : prev;
}

const ceilSlot = (t: number) => Math.ceil(t / SLOT_MS) * SLOT_MS;

// 세션이 now를 포함하는 거래일(공휴일 중간 정지 구간 포함). 장중 배치의 ctx.tradeDate.
export function findSessionDay(now: Date, days: readonly TradingDaySession[]): string | null {
  const t = now.getTime();
  return (
    sessions(days).find((s) => s.openAt.getTime() <= t && t < s.closeAt.getTime())?.tradeDate ??
    null
  );
}

// 세션이 끝난 가장 최근 거래일. 일일 정산 대상 판정에 쓴다.
export function lastClosedTradeDate(now: Date, days: readonly TradingDaySession[]): string | null {
  const t = now.getTime();
  return sessions(days).findLast((s) => s.closeAt.getTime() <= t)?.tradeDate ?? null;
}

// 다음 장중 배치 완료 예상 시각(D-048). 정산 대기 세션의 슬롯은 정산 ① 예상 완료 뒤부터,
// 그 시각이 이미 지났으면 지금 다음 슬롯부터 센다. 넘겨받은 달력 안에서 못 찾으면 null.
function nextUpdateAt(
  now: Date,
  days: readonly TradingDaySession[],
  lastSettledTradeDate: string | null,
): Date | null {
  const t = now.getTime();
  // 지금 돌고 있는 슬롯도 센다(s + 소요 > now).
  const earliest = (Math.floor((t - INTRADAY_EXPECTED_MS) / SLOT_MS) + 1) * SLOT_MS;
  for (const s of sessions(days)) {
    if (s.closeAt.getTime() <= earliest) continue;
    let from = Math.max(earliest, s.openAt.getTime());
    const pending = unsettledPrevious(days, s.index, lastSettledTradeDate);
    if (pending !== null) {
      const settled =
        zonedTimeToUtc(pending, SETTLE_AT, CME_TIME_ZONE).getTime() + SETTLE_STEP1_EXPECTED_MS;
      from = Math.max(from, settled, t + 1);
    }
    let slot = ceilSlot(from);
    const day = days[s.index];
    if (inHalt(day, slot)) slot = ceilSlot(day.haltEndAt!.getTime());
    if (slot < s.closeAt.getTime()) return new Date(slot + INTRADAY_EXPECTED_MS);
  }
  return null;
}

export function marketStatus(
  now: Date,
  days: readonly TradingDaySession[],
  lastSettledTradeDate: string | null,
): MarketStatus {
  const t = now.getTime();
  const next = nextUpdateAt(now, days, lastSettledTradeDate);
  const current = sessions(days).find((s) => s.openAt.getTime() <= t && t < s.closeAt.getTime());
  if (!current) {
    return { state: 'CLOSED', tradeDate: lastClosedTradeDate(now, days), nextUpdateAt: next };
  }
  if (inHalt(days[current.index], t)) {
    return { state: 'CLOSED', tradeDate: current.tradeDate, nextUpdateAt: next };
  }
  const pending = unsettledPrevious(days, current.index, lastSettledTradeDate);
  return pending !== null
    ? { state: 'SETTLEMENT_PENDING', tradeDate: pending, nextUpdateAt: next }
    : { state: 'OPEN', tradeDate: current.tradeDate, nextUpdateAt: next };
}

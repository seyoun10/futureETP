// rare 레벨 알림 판정: 레벨 닿음, 판정마다 방향별 1건, 거부 시간 보류, 재시도·지연 발송 계획
// (product.md 6. rare 레벨 도달 알림, D-006, D-007, D-023, D-026, D-069).
// DB 조회·발송은 호출자(INTRADAY·DEFERRED_PUSH) 몫이다. 레벨 p는 작을수록 드물다.
import type { Basis, CommodityCode, Direction, MaPeriod, Window } from '@futureetp/shared';
import type { AlertStatus } from '../constants.ts';
import { rareLevelDisparity } from './disparity.ts';

export type AlertLevelRecord = { direction: Direction; rareLevel: number; status: AlertStatus };

export type DetectionAction = 'SEND' | 'HELD' | 'SUPPRESSED';

// WAIT: 거부 시간이라 RETRY 그대로 두고 거부 시간이 끝난 뒤 첫 배치에서 다시 판단한다
export type RetryAction = 'SEND' | 'SUPPRESSED' | 'WAIT';

export type Detection = {
  direction: Direction;
  rareLevel: number;
  action: DetectionAction;
  // 판정 이격도: UP은 고가, DOWN은 저가 기준
  disparity: number;
};

export type AlertKey = {
  commodityCode: CommodityCode;
  basis: Basis;
  maPeriod: MaPeriod;
  window: Window;
  tradeDate: string;
  direction: Direction;
  rareLevel: number;
};

// 더 드문 레벨의 이 상태 기록이 있으면 덜 드문 레벨은 덮였다(보냈거나 곧 보낼 것)
const COVERING: readonly AlertStatus[] = ['SENT', 'HELD', 'RETRY'];

const byRarity = (a: number, b: number) => a - b;

// 닿은 레벨(드문 순). UP은 고가 이격도가 레벨 이상, DOWN은 저가 이격도가 레벨 이하(경계 포함)
export function touchedLevels(
  sorted: readonly number[],
  levels: readonly number[],
  direction: Direction,
  disparity: number | null,
): number[] {
  if (disparity === null || sorted.length === 0) return [];
  return levels
    .filter((p) => {
      const level = rareLevelDisparity(sorted, direction, p);
      return direction === 'UP' ? disparity >= level : disparity <= level;
    })
    .sort(byRarity);
}

function localMinuteOfDay(now: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return get('hour') * 60 + get('minute');
}

// 알림 거부 시간: 시작 포함·종료 제외, 자정 넘김 허용(D-026). 끄기(null)면 false
export function isQuietTime(
  now: Date,
  timeZone: string,
  startMin: number | null,
  endMin: number | null,
): boolean {
  if (startMin === null || endMin === null) return false;
  const m = localMinuteOfDay(now, timeZone);
  return startMin < endMin ? startMin <= m && m < endMin : m >= startMin || m < endMin;
}

const isCovered = (records: readonly AlertLevelRecord[], direction: Direction, p: number) =>
  records.some((r) => r.direction === direction && r.rareLevel < p && COVERING.includes(r.status));

// 한 번의 판정에서 새로 넣을 기록. existing은 같은 조건·CME 거래일의 기록이다.
// 방향별로 닿은 가장 드문 레벨이 처음이고 덮이지 않았으면 보내고(거부 시간이면 보류), 나머지는 SUPPRESSED
export function planDetections(input: {
  sorted: readonly number[];
  levels: readonly number[];
  highDisparity: number | null;
  lowDisparity: number | null;
  existing: readonly AlertLevelRecord[];
  quiet: boolean;
}): Detection[] {
  const { sorted, levels, existing, quiet } = input;
  const out: Detection[] = [];
  const sides: [Direction, number | null][] = [
    ['UP', input.highDisparity],
    ['DOWN', input.lowDisparity],
  ];
  for (const [direction, disparity] of sides) {
    const touched = touchedLevels(sorted, levels, direction, disparity);
    if (touched.length === 0 || disparity === null) continue;
    const recorded = (p: number) =>
      existing.some((r) => r.direction === direction && r.rareLevel === p);
    const rarest = touched[0];
    const sendRarest = !recorded(rarest) && !isCovered(existing, direction, rarest);
    for (const p of touched) {
      if (recorded(p)) continue;
      const action: DetectionAction =
        p === rarest && sendRarest ? (quiet ? 'HELD' : 'SEND') : 'SUPPRESSED';
      out.push({ direction, rareLevel: p, action, disparity });
    }
  }
  return out;
}

const sameGroup = (a: AlertKey, b: AlertKey) =>
  a.commodityCode === b.commodityCode &&
  a.basis === b.basis &&
  a.maPeriod === b.maPeriod &&
  a.window === b.window &&
  a.tradeDate === b.tradeDate &&
  a.direction === b.direction;

// RETRY 기록의 1회 재발송 계획. 같은 조건·거래일·방향에서 더 드문 레벨이 덮었으면 SUPPRESSED(D-023).
// 거부 시간에는 HELD로 바꾸지 않고 기다린다(HELD는 지연 발송에서 첫 발송으로 다뤄 재시도 횟수를 잃음)
export function planRetries<Id>(
  retries: readonly (AlertKey & { id: Id })[],
  existing: readonly (AlertKey & { status: AlertStatus })[],
  quiet: boolean,
): { id: Id; action: RetryAction }[] {
  const records = [...existing, ...retries.map((r) => ({ ...r, status: 'RETRY' as const }))];
  return retries.map((retry) => {
    const covered = isCovered(
      records.filter((r) => sameGroup(r, retry)),
      retry.direction,
      retry.rareLevel,
    );
    return { id: retry.id, action: covered ? 'SUPPRESSED' : quiet ? 'WAIT' : 'SEND' };
  });
}

// 발송 뒤 상태: 한 기기라도 성공하면 SENT, 모두 실패면 첫 발송은 RETRY·재시도는 FAILED(D-023)
export function statusAfterSend(delivered: boolean, isRetry: boolean): 'SENT' | 'RETRY' | 'FAILED' {
  if (delivered) return 'SENT';
  return isRetry ? 'FAILED' : 'RETRY';
}

// 거부 시간이 끝난 뒤 보류 건 처리: 원자재·방향별로 가장 드문 1건(같으면 늦게 감지한 것)만 보낸다
export function planDeferred<Id>(
  held: readonly {
    id: Id;
    commodityCode: CommodityCode;
    direction: Direction;
    rareLevel: number;
    detectedAt: Date;
  }[],
  quiet: boolean,
): { id: Id; action: 'SEND' | 'SUPPRESSED' }[] {
  if (quiet) return [];
  const winners = new Map<string, (typeof held)[number]>();
  for (const h of held) {
    const key = `${h.commodityCode}|${h.direction}`;
    const best = winners.get(key);
    if (
      best === undefined ||
      h.rareLevel < best.rareLevel ||
      (h.rareLevel === best.rareLevel && h.detectedAt > best.detectedAt)
    ) {
      winners.set(key, h);
    }
  }
  const sendRows = new Set([...winners.values()]);
  return held.map((h) => ({ id: h.id, action: sendRows.has(h) ? 'SEND' : 'SUPPRESSED' }));
}

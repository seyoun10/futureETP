// 명세(product.md "6. rare 레벨 도달 알림", D-006·D-023·D-026·D-069)만 보고 작성한 테스트(D-057).
import { describe, expect, it } from 'vitest';
import type { Direction } from '@futureetp/shared';
import type { AlertStatus } from '../constants.ts';
import {
  isQuietTime,
  planDeferred,
  planDetections,
  planRetries,
  statusAfterSend,
  touchedLevels,
  type AlertKey,
  type AlertLevelRecord,
} from './alert.ts';
import { rareLevelDisparity } from './disparity.ts';

// 0, 1, …, 100: q번째 백분위가 정확히 q다. 위 방향 p% 경계 = 100 − p, 아래 방향 p% 경계 = p
const D = [...Array(101).keys()];
// 순서를 섞은 5개 레벨(드문 순: 1, 2, 5, 10, 20)
const LEVELS = [20, 1, 5, 10, 2];

const rec = (direction: Direction, rareLevel: number, status: AlertStatus): AlertLevelRecord => ({
  direction,
  rareLevel,
  status,
});

const detect = (input: {
  highDisparity?: number | null;
  lowDisparity?: number | null;
  existing?: AlertLevelRecord[];
  quiet?: boolean;
  levels?: number[];
  sorted?: number[];
}) =>
  planDetections({
    sorted: input.sorted ?? D,
    levels: input.levels ?? LEVELS,
    highDisparity: input.highDisparity ?? null,
    lowDisparity: input.lowDisparity ?? null,
    existing: input.existing ?? [],
    quiet: input.quiet ?? false,
  });

describe('touchedLevels', () => {
  it('UP은 고가 이격도가 경계 이상이면 닿음(경계 포함), 드문 순으로 돌려준다', () => {
    expect(touchedLevels(D, LEVELS, 'UP', 96)).toEqual([5, 10, 20]);
    const t5 = rareLevelDisparity(D, 'UP', 5);
    expect(touchedLevels(D, LEVELS, 'UP', t5)).toEqual([5, 10, 20]);
    expect(touchedLevels(D, LEVELS, 'UP', t5 - 1e-9)).toEqual([10, 20]);
  });

  it('DOWN은 저가 이격도가 경계 이하이면 닿음(경계 포함), 드문 순으로 돌려준다', () => {
    expect(touchedLevels(D, LEVELS, 'DOWN', 4)).toEqual([5, 10, 20]);
    const t5 = rareLevelDisparity(D, 'DOWN', 5);
    expect(touchedLevels(D, LEVELS, 'DOWN', t5)).toEqual([5, 10, 20]);
    expect(touchedLevels(D, LEVELS, 'DOWN', t5 + 1e-9)).toEqual([10, 20]);
  });

  it('모든 레벨에 닿으면 5개 모두 p 오름차순', () => {
    expect(touchedLevels(D, LEVELS, 'UP', 100)).toEqual([1, 2, 5, 10, 20]);
    expect(touchedLevels(D, LEVELS, 'DOWN', 0)).toEqual([1, 2, 5, 10, 20]);
  });

  it('어느 레벨에도 닿지 않으면 빈 배열', () => {
    expect(touchedLevels(D, LEVELS, 'UP', 50)).toEqual([]);
    expect(touchedLevels(D, LEVELS, 'DOWN', 50)).toEqual([]);
    // 방향이 반대인 극값은 닿지 않는다
    expect(touchedLevels(D, LEVELS, 'UP', 0)).toEqual([]);
    expect(touchedLevels(D, LEVELS, 'DOWN', 100)).toEqual([]);
  });

  it('이격도가 null이면 빈 배열', () => {
    expect(touchedLevels(D, LEVELS, 'UP', null)).toEqual([]);
    expect(touchedLevels(D, LEVELS, 'DOWN', null)).toEqual([]);
  });

  it('분포가 비면 빈 배열', () => {
    expect(touchedLevels([], LEVELS, 'UP', 1000)).toEqual([]);
    expect(touchedLevels([], LEVELS, 'DOWN', -1000)).toEqual([]);
  });

  it('소수 레벨도 rare 레벨 이격도와 같은 경계로 판정한다', () => {
    const sorted = [-8.3, -2.1, 0.4, 1.7, 3.2, 6.9];
    const levels = [0.5, 7.3, 12.5, 25, 49.9];
    const t = rareLevelDisparity(sorted, 'UP', 12.5);
    expect(touchedLevels(sorted, levels, 'UP', t)).toEqual([12.5, 25, 49.9]);
    const d = rareLevelDisparity(sorted, 'DOWN', 7.3);
    expect(touchedLevels(sorted, levels, 'DOWN', d)).toEqual([7.3, 12.5, 25, 49.9]);
  });
});

describe('isQuietTime', () => {
  const at = (iso: string) => new Date(iso);

  it('자정을 넘지 않는 구간: 시작 포함, 종료 제외(Asia/Seoul 09:00~18:00)', () => {
    const q = (iso: string) => isQuietTime(at(iso), 'Asia/Seoul', 540, 1080);
    expect(q('2026-10-27T00:00:00Z')).toBe(true); // 09:00 KST
    expect(q('2026-10-27T08:59:00Z')).toBe(true); // 17:59
    expect(q('2026-10-27T09:00:00Z')).toBe(false); // 18:00
    expect(q('2026-10-26T23:59:00Z')).toBe(false); // 08:59
    expect(q('2026-10-27T03:00:00Z')).toBe(true); // 12:00
  });

  it('자정을 넘는 구간(Asia/Seoul 23:00~07:00)', () => {
    const q = (iso: string) => isQuietTime(at(iso), 'Asia/Seoul', 1380, 420);
    expect(q('2026-10-27T14:00:00Z')).toBe(true); // 23:00 KST 시작 포함
    expect(q('2026-10-27T13:59:00Z')).toBe(false); // 22:59
    expect(q('2026-10-27T15:00:00Z')).toBe(true); // 00:00
    expect(q('2026-10-27T21:59:00Z')).toBe(true); // 06:59
    expect(q('2026-10-27T22:00:00Z')).toBe(false); // 07:00 종료 제외
    expect(q('2026-10-27T03:00:00Z')).toBe(false); // 12:00
  });

  it('서머타임 시간대는 그날의 현지 시각으로 판정한다(America/New_York 23:00~07:00)', () => {
    const q = (iso: string) => isQuietTime(at(iso), 'America/New_York', 1380, 420);
    // 2026-11-01 서머타임 종료 전(EDT, UTC−4)
    expect(q('2026-10-31T10:30:00Z')).toBe(true); // 06:30 EDT
    expect(q('2026-10-31T11:00:00Z')).toBe(false); // 07:00 EDT
    expect(q('2026-10-31T11:30:00Z')).toBe(false); // 07:30 EDT
    // 종료 후(EST, UTC−5): 같은 UTC 시각이 한 시간 이르다
    expect(q('2026-11-01T11:30:00Z')).toBe(true); // 06:30 EST
    expect(q('2026-11-01T12:00:00Z')).toBe(false); // 07:00 EST
    expect(q('2026-11-02T04:00:00Z')).toBe(true); // 23:00 EST
    expect(q('2026-11-02T03:59:00Z')).toBe(false); // 22:59 EST
    // 2026-03-08 서머타임 시작 전후
    expect(q('2026-03-07T11:00:00Z')).toBe(true); // 06:00 EST
    expect(q('2026-03-08T11:00:00Z')).toBe(false); // 07:00 EDT
  });

  it('시작·종료 중 하나라도 null이면 false', () => {
    const now = at('2026-10-27T15:00:00Z');
    expect(isQuietTime(now, 'Asia/Seoul', null, null)).toBe(false);
    expect(isQuietTime(now, 'Asia/Seoul', 1380, null)).toBe(false);
    expect(isQuietTime(now, 'Asia/Seoul', null, 420)).toBe(false);
  });
});

describe('planDetections', () => {
  it('한 방향에서 여러 레벨에 닿으면 가장 드문 레벨만 SEND, 나머지는 SUPPRESSED', () => {
    expect(detect({ highDisparity: 96, lowDisparity: 50 })).toEqual([
      { direction: 'UP', rareLevel: 5, action: 'SEND', disparity: 96 },
      { direction: 'UP', rareLevel: 10, action: 'SUPPRESSED', disparity: 96 },
      { direction: 'UP', rareLevel: 20, action: 'SUPPRESSED', disparity: 96 },
    ]);
  });

  it('DOWN은 저가 이격도로 판정하고 결과에 저가 이격도를 붙인다', () => {
    expect(detect({ highDisparity: 50, lowDisparity: 9 })).toEqual([
      { direction: 'DOWN', rareLevel: 10, action: 'SEND', disparity: 9 },
      { direction: 'DOWN', rareLevel: 20, action: 'SUPPRESSED', disparity: 9 },
    ]);
  });

  it('경계값과 같으면 닿음(UP 고가 = 95 → 5% 닿음, DOWN 저가 = 5 → 5% 닿음)', () => {
    const hi = rareLevelDisparity(D, 'UP', 5);
    const lo = rareLevelDisparity(D, 'DOWN', 5);
    expect(detect({ highDisparity: hi, lowDisparity: lo })).toEqual([
      { direction: 'UP', rareLevel: 5, action: 'SEND', disparity: hi },
      { direction: 'UP', rareLevel: 10, action: 'SUPPRESSED', disparity: hi },
      { direction: 'UP', rareLevel: 20, action: 'SUPPRESSED', disparity: hi },
      { direction: 'DOWN', rareLevel: 5, action: 'SEND', disparity: lo },
      { direction: 'DOWN', rareLevel: 10, action: 'SUPPRESSED', disparity: lo },
      { direction: 'DOWN', rareLevel: 20, action: 'SUPPRESSED', disparity: lo },
    ]);
  });

  it('두 방향 모두 닿으면 UP 행 먼저, 그다음 DOWN(방향별로 p 오름차순)', () => {
    // 하루 변동이 커서 고가·저가가 모두 꼬리에 닿은 경우
    const out = detect({ highDisparity: 99.5, lowDisparity: 15 });
    expect(out.map((d) => [d.direction, d.rareLevel, d.action])).toEqual([
      ['UP', 1, 'SEND'],
      ['UP', 2, 'SUPPRESSED'],
      ['UP', 5, 'SUPPRESSED'],
      ['UP', 10, 'SUPPRESSED'],
      ['UP', 20, 'SUPPRESSED'],
      ['DOWN', 20, 'SEND'],
    ]);
  });

  it('이격도가 null이면 그 방향은 결과가 없다', () => {
    expect(detect({ highDisparity: null, lowDisparity: null })).toEqual([]);
    expect(detect({ highDisparity: null, lowDisparity: 4 }).map((d) => d.direction)).toEqual([
      'DOWN',
      'DOWN',
      'DOWN',
    ]);
  });

  it('분포가 비면 빈 결과', () => {
    expect(detect({ sorted: [], highDisparity: 1000, lowDisparity: -1000 })).toEqual([]);
  });

  it('닿은 레벨이 없으면 빈 결과', () => {
    expect(detect({ highDisparity: 60, lowDisparity: 40 })).toEqual([]);
  });

  it('거부 시간이면 가장 드문 레벨은 HELD, 나머지는 SUPPRESSED', () => {
    expect(detect({ highDisparity: 96, quiet: true })).toEqual([
      { direction: 'UP', rareLevel: 5, action: 'HELD', disparity: 96 },
      { direction: 'UP', rareLevel: 10, action: 'SUPPRESSED', disparity: 96 },
      { direction: 'UP', rareLevel: 20, action: 'SUPPRESSED', disparity: 96 },
    ]);
  });

  it('가장 드문 닿은 레벨이 이미 기록됐으면 기록 없는 닿은 레벨만 SUPPRESSED로 낸다', () => {
    // 오늘 앞 배치에서 5%를 보냈고 10%는 밀렸다. 설정을 바꿔 20% 대신 30%가 생겼다
    const existing = [rec('UP', 5, 'SENT'), rec('UP', 10, 'SUPPRESSED')];
    expect(detect({ levels: [1, 2, 5, 10, 30], highDisparity: 96, existing })).toEqual([
      { direction: 'UP', rareLevel: 30, action: 'SUPPRESSED', disparity: 96 },
    ]);
  });

  it('닿은 레벨이 모두 기록됐으면 빈 결과', () => {
    const existing = [
      rec('UP', 5, 'SENT'),
      rec('UP', 10, 'SUPPRESSED'),
      rec('UP', 20, 'SUPPRESSED'),
    ];
    expect(detect({ highDisparity: 96, existing })).toEqual([]);
  });

  it('가장 드문 레벨이 어떤 상태로든 기록됐으면(SUPPRESSED·FAILED 포함) 다시 보내지 않는다', () => {
    for (const status of ['SUPPRESSED', 'FAILED', 'HELD', 'RETRY'] as const) {
      expect(detect({ highDisparity: 96, existing: [rec('UP', 5, status)] })).toEqual([
        { direction: 'UP', rareLevel: 10, action: 'SUPPRESSED', disparity: 96 },
        { direction: 'UP', rareLevel: 20, action: 'SUPPRESSED', disparity: 96 },
      ]);
    }
  });

  it('같은 날 덜 드문 레벨을 보낸 뒤 더 드문 레벨에 새로 닿으면 다시 SEND', () => {
    const existing = [rec('UP', 10, 'SENT'), rec('UP', 20, 'SUPPRESSED')];
    expect(detect({ highDisparity: 96, existing })).toEqual([
      { direction: 'UP', rareLevel: 5, action: 'SEND', disparity: 96 },
    ]);
  });

  it('더 드문 레벨이 보류(HELD) 중이어도 새로 닿은 더 드문 레벨은 SEND(거부 시간이면 HELD)', () => {
    const existing = [rec('UP', 10, 'HELD'), rec('UP', 20, 'SUPPRESSED')];
    expect(detect({ highDisparity: 98.5, existing, quiet: true })).toEqual([
      { direction: 'UP', rareLevel: 2, action: 'HELD', disparity: 98.5 },
      { direction: 'UP', rareLevel: 5, action: 'SUPPRESSED', disparity: 98.5 },
    ]);
  });

  describe('설정 변경으로 새로 생긴 덜 드문 레벨', () => {
    // 아까 레벨 [1, ...]로 1%에 닿았고, 지금은 레벨을 [3, 6, 12, 25, 40]으로 바꿨다
    const levels = [3, 6, 12, 25, 40];
    const touched = [6, 12, 25, 40]; // 고가 96: 경계 97, 94, 88, 75, 60

    it.each(['SENT', 'HELD', 'RETRY'] as const)(
      '더 드문 레벨이 %s이면 덮여서 모두 SUPPRESSED',
      (status) => {
        const out = detect({ levels, highDisparity: 96, existing: [rec('UP', 1, status)] });
        expect(out).toEqual(
          touched.map((p) => ({
            direction: 'UP',
            rareLevel: p,
            action: 'SUPPRESSED',
            disparity: 96,
          })),
        );
      },
    );

    it.each(['SUPPRESSED', 'FAILED'] as const)(
      '더 드문 레벨이 %s뿐이면 덮이지 않아 가장 드문 레벨을 SEND',
      (status) => {
        const out = detect({ levels, highDisparity: 96, existing: [rec('UP', 1, status)] });
        expect(out.map((d) => [d.rareLevel, d.action])).toEqual([
          [6, 'SEND'],
          [12, 'SUPPRESSED'],
          [25, 'SUPPRESSED'],
          [40, 'SUPPRESSED'],
        ]);
      },
    );

    it('덮였으면 거부 시간이어도 HELD가 아니라 SUPPRESSED', () => {
      const out = detect({
        levels,
        highDisparity: 96,
        existing: [rec('UP', 1, 'SENT')],
        quiet: true,
      });
      expect(out.every((d) => d.action === 'SUPPRESSED')).toBe(true);
      expect(out).toHaveLength(4);
    });

    it('덜 드문 레벨의 SENT 기록은 덮지 않는다', () => {
      const out = detect({ levels, highDisparity: 96, existing: [rec('UP', 50, 'SENT')] });
      expect(out[0]).toEqual({ direction: 'UP', rareLevel: 6, action: 'SEND', disparity: 96 });
    });
  });

  it('방향은 서로 독립: UP 기록은 DOWN을 덮지 않는다', () => {
    const existing = [rec('UP', 1, 'SENT'), rec('UP', 5, 'SENT')];
    expect(detect({ highDisparity: 96, lowDisparity: 4, existing })).toEqual([
      { direction: 'UP', rareLevel: 10, action: 'SUPPRESSED', disparity: 96 },
      { direction: 'UP', rareLevel: 20, action: 'SUPPRESSED', disparity: 96 },
      { direction: 'DOWN', rareLevel: 5, action: 'SEND', disparity: 4 },
      { direction: 'DOWN', rareLevel: 10, action: 'SUPPRESSED', disparity: 4 },
      { direction: 'DOWN', rareLevel: 20, action: 'SUPPRESSED', disparity: 4 },
    ]);
  });

  it('DOWN 기록도 DOWN만 덮는다', () => {
    const existing = [rec('DOWN', 1, 'SENT')];
    expect(detect({ highDisparity: 96, lowDisparity: 4, existing })).toEqual([
      { direction: 'UP', rareLevel: 5, action: 'SEND', disparity: 96 },
      { direction: 'UP', rareLevel: 10, action: 'SUPPRESSED', disparity: 96 },
      { direction: 'UP', rareLevel: 20, action: 'SUPPRESSED', disparity: 96 },
      { direction: 'DOWN', rareLevel: 5, action: 'SUPPRESSED', disparity: 4 },
      { direction: 'DOWN', rareLevel: 10, action: 'SUPPRESSED', disparity: 4 },
      { direction: 'DOWN', rareLevel: 20, action: 'SUPPRESSED', disparity: 4 },
    ]);
  });
});

describe('planRetries', () => {
  const BASE: AlertKey = {
    commodityCode: 'GC',
    basis: 'FRONT',
    maPeriod: 20,
    window: 'Y5',
    tradeDate: '2026-10-27',
    direction: 'UP',
    rareLevel: 5,
  };
  const key = (over: Partial<AlertKey> = {}): AlertKey => ({ ...BASE, ...over });
  const retry = (id: string, over: Partial<AlertKey> = {}) => ({ ...key(over), id });
  const row = (status: AlertStatus, over: Partial<AlertKey> = {}) => ({ ...key(over), status });

  it('덮이지 않은 RETRY는 SEND, 거부 시간이면 WAIT(RETRY 유지)', () => {
    const retries = [retry('a')];
    const existing = [row('RETRY')];
    expect(planRetries(retries, existing, false)).toEqual([{ id: 'a', action: 'SEND' }]);
    expect(planRetries(retries, existing, true)).toEqual([{ id: 'a', action: 'WAIT' }]);
    // existing에 RETRY 자신이 없어도 같다
    expect(planRetries(retries, [], false)).toEqual([{ id: 'a', action: 'SEND' }]);
  });

  it('같은 조건·거래일·방향에 더 드문 SENT가 있으면 SUPPRESSED', () => {
    const retries = [retry('a')];
    const withSelf = [row('RETRY'), row('SENT', { rareLevel: 2 })];
    const withoutSelf = [row('SENT', { rareLevel: 2 })];
    expect(planRetries(retries, withSelf, false)).toEqual([{ id: 'a', action: 'SUPPRESSED' }]);
    expect(planRetries(retries, withoutSelf, false)).toEqual([{ id: 'a', action: 'SUPPRESSED' }]);
    // 거부 시간이어도 덮였으면 SUPPRESSED
    expect(planRetries(retries, withSelf, true)).toEqual([{ id: 'a', action: 'SUPPRESSED' }]);
  });

  it.each(['HELD', 'RETRY'] as const)('더 드문 %s도 덮는다', (status) => {
    expect(planRetries([retry('a')], [row(status, { rareLevel: 1 })], false)).toEqual([
      { id: 'a', action: 'SUPPRESSED' },
    ]);
  });

  it.each(['SUPPRESSED', 'FAILED'] as const)('더 드문 %s는 덮지 않는다', (status) => {
    expect(planRetries([retry('a')], [row('RETRY'), row(status, { rareLevel: 1 })], false)).toEqual(
      [{ id: 'a', action: 'SEND' }],
    );
  });

  it('덜 드문 레벨의 SENT는 덮지 않는다', () => {
    expect(
      planRetries([retry('a')], [row('RETRY'), row('SENT', { rareLevel: 10 })], false),
    ).toEqual([{ id: 'a', action: 'SEND' }]);
  });

  it('같은 조건·방향에 RETRY가 여럿이면 가장 드문 1건만 SEND, 순서는 입력대로', () => {
    const retries = [retry('r5'), retry('r2', { rareLevel: 2 }), retry('r10', { rareLevel: 10 })];
    const expected = [
      { id: 'r5', action: 'SUPPRESSED' },
      { id: 'r2', action: 'SEND' },
      { id: 'r10', action: 'SUPPRESSED' },
    ];
    const existing = [
      row('RETRY'),
      row('RETRY', { rareLevel: 2 }),
      row('RETRY', { rareLevel: 10 }),
    ];
    expect(planRetries(retries, existing, false)).toEqual(expected);
    expect(planRetries(retries, [], false)).toEqual(expected);
  });

  it('여러 RETRY 중 가장 드문 1건은 거부 시간이면 WAIT, 나머지는 SUPPRESSED', () => {
    const retries = [retry('r5'), retry('r2', { rareLevel: 2 })];
    expect(planRetries(retries, [], true)).toEqual([
      { id: 'r5', action: 'SUPPRESSED' },
      { id: 'r2', action: 'WAIT' },
    ]);
  });

  it('거래일·조건·방향이 다른 기록은 덮지 않는다', () => {
    const others: Partial<AlertKey>[] = [
      { tradeDate: '2026-10-26' },
      { commodityCode: 'SI' },
      { basis: 'KR' },
      { maPeriod: 50 },
      { window: 'Y10' },
      { direction: 'DOWN' },
    ];
    for (const over of others) {
      const existing = [row('RETRY'), row('SENT', { ...over, rareLevel: 1 })];
      expect(planRetries([retry('a')], existing, false)).toEqual([{ id: 'a', action: 'SEND' }]);
    }
  });

  it('서로 다른 묶음의 RETRY는 각각 판정한다', () => {
    const retries = [
      retry('up'),
      retry('down', { direction: 'DOWN', rareLevel: 10 }),
      retry('prev', { tradeDate: '2026-10-26', rareLevel: 20 }),
    ];
    const existing = [row('SENT', { direction: 'DOWN', rareLevel: 2 })];
    expect(planRetries(retries, existing, false)).toEqual([
      { id: 'up', action: 'SEND' },
      { id: 'down', action: 'SUPPRESSED' },
      { id: 'prev', action: 'SEND' },
    ]);
  });

  it('RETRY가 없으면 빈 결과', () => {
    expect(planRetries([], [row('SENT')], false)).toEqual([]);
  });
});

describe('statusAfterSend', () => {
  it.each([
    [true, false, 'SENT'],
    [true, true, 'SENT'],
    [false, false, 'RETRY'],
    [false, true, 'FAILED'],
  ] as const)('delivered=%s, isRetry=%s → %s', (delivered, isRetry, expected) => {
    expect(statusAfterSend(delivered, isRetry)).toBe(expected);
  });
});

describe('planDeferred', () => {
  const held = (
    id: string,
    commodityCode: 'GC' | 'SI',
    direction: Direction,
    rareLevel: number,
    detectedAt: string,
  ) => ({ id, commodityCode, direction, rareLevel, detectedAt: new Date(detectedAt) });

  it('거부 시간이면 아무것도 하지 않는다', () => {
    const rows = [held('a', 'GC', 'UP', 5, '2026-10-27T18:00:00Z')];
    expect(planDeferred(rows, true)).toEqual([]);
  });

  it('원자재·방향으로 묶어 가장 드문 1건만 SEND, 순서는 입력대로', () => {
    const rows = [
      held('gcUp10', 'GC', 'UP', 10, '2026-10-27T17:00:00Z'),
      held('gcUp5', 'GC', 'UP', 5, '2026-10-27T18:00:00Z'),
      held('gcDown10', 'GC', 'DOWN', 10, '2026-10-27T18:15:00Z'),
      held('siUp20', 'SI', 'UP', 20, '2026-10-27T18:30:00Z'),
      held('gcUp20', 'GC', 'UP', 20, '2026-10-27T19:00:00Z'),
    ];
    expect(planDeferred(rows, false)).toEqual([
      { id: 'gcUp10', action: 'SUPPRESSED' },
      { id: 'gcUp5', action: 'SEND' },
      { id: 'gcDown10', action: 'SEND' },
      { id: 'siUp20', action: 'SEND' },
      { id: 'gcUp20', action: 'SUPPRESSED' },
    ]);
  });

  it('보류 중 CME 거래일이 바뀌어도 방향별 1건(감지 시각이 다른 날이어도 함께 묶음)', () => {
    const rows = [
      held('prevDay', 'GC', 'UP', 10, '2026-10-26T20:00:00Z'),
      held('nextDay', 'GC', 'UP', 5, '2026-10-27T00:30:00Z'),
    ];
    expect(planDeferred(rows, false)).toEqual([
      { id: 'prevDay', action: 'SUPPRESSED' },
      { id: 'nextDay', action: 'SEND' },
    ]);
  });

  it('같은 레벨이면 detectedAt이 늦은 쪽을 보낸다', () => {
    const rows = [
      held('late', 'GC', 'DOWN', 5, '2026-10-27T20:00:00Z'),
      held('early', 'GC', 'DOWN', 5, '2026-10-27T18:00:00Z'),
    ];
    expect(planDeferred(rows, false)).toEqual([
      { id: 'late', action: 'SEND' },
      { id: 'early', action: 'SUPPRESSED' },
    ]);
  });

  it('더 드문 레벨이 있으면 늦게 감지된 덜 드문 레벨보다 우선한다', () => {
    const rows = [
      held('rare', 'GC', 'UP', 2, '2026-10-27T15:00:00Z'),
      held('lateCommon', 'GC', 'UP', 10, '2026-10-27T21:00:00Z'),
    ];
    expect(planDeferred(rows, false)).toEqual([
      { id: 'rare', action: 'SEND' },
      { id: 'lateCommon', action: 'SUPPRESSED' },
    ]);
  });

  it('보류 건이 없으면 빈 결과', () => {
    expect(planDeferred([], false)).toEqual([]);
  });
});

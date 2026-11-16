// 속성 기반 테스트(D-129): 임의의 시각·정산 진행에서 장 상태(D-022)와 다음 갱신 시각이 서로 맞는지 본다.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  findSessionDay,
  lastClosedTradeDate,
  marketStatus,
  type TradingDaySession,
} from './marketState.ts';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;
// 2026-01-05(월) 거래일 세션: 전날 17:00 CT(23:00 UTC) ~ 16:00 CT(22:00 UTC)
const FIRST_OPEN = Date.UTC(2026, 0, 4, 23);

// 연속 평일 거래일. 과거 행(세션 없음, D-048)과 정지 구간이 섞인다
const calendar = fc
  .array(fc.record({ legacy: fc.boolean(), halt: fc.boolean() }), { minLength: 1, maxLength: 10 })
  .map((flags) =>
    flags.map(({ legacy, halt }, i): TradingDaySession => {
      const open = FIRST_OPEN + i * DAY_MS;
      const tradeDate = new Date(open + DAY_MS).toISOString().slice(0, 10);
      if (legacy && i === 0) {
        return {
          tradeDate,
          sessionOpenAt: null,
          sessionCloseAt: null,
          haltStartAt: null,
          haltEndAt: null,
        };
      }
      return {
        tradeDate,
        sessionOpenAt: new Date(open),
        sessionCloseAt: new Date(open + 23 * HOUR_MS),
        haltStartAt: halt ? new Date(open + 13 * HOUR_MS) : null,
        haltEndAt: halt ? new Date(open + 18 * HOUR_MS) : null,
      };
    }),
  );

const scenario = calendar.chain((days) =>
  fc.record({
    days: fc.constant(days),
    now: fc
      .integer({ min: FIRST_OPEN - DAY_MS, max: FIRST_OPEN + (days.length + 1) * DAY_MS })
      .map((t) => new Date(t)),
    settled: fc.option(fc.constantFrom(...days.map((d) => d.tradeDate)), { nil: null }),
  }),
);

describe('marketStatus 속성', () => {
  it('세션 밖이면 휴장이고 표시 거래일은 마지막으로 끝난 세션이다', () => {
    fc.assert(
      fc.property(scenario, ({ days, now, settled }) => {
        fc.pre(findSessionDay(now, days) === null);
        expect(marketStatus(now, days, settled)).toMatchObject({
          state: 'CLOSED',
          tradeDate: lastClosedTradeDate(now, days),
        });
      }),
    );
  });

  it('세션 안이면 직전 거래일 정산 전에는 정산 대기(직전 거래일 표시), 정산 뒤에는 그 세션 거래일이다', () => {
    fc.assert(
      fc.property(scenario, ({ days, now, settled }) => {
        const session = findSessionDay(now, days);
        fc.pre(session !== null);
        const index = days.findIndex((d) => d.tradeDate === session);
        const prev = days[index - 1]?.tradeDate;
        const status = marketStatus(now, days, settled);
        if (prev !== undefined && (settled === null || settled < prev)) {
          expect(status).toMatchObject({ state: 'SETTLEMENT_PENDING', tradeDate: prev });
        } else {
          expect(status.tradeDate).toBe(session);
          // 정지 구간이면 휴장, 아니면 장중(D-062)
          const day = days[index]!;
          const t = now.getTime();
          const halted =
            day.haltStartAt !== null &&
            day.haltEndAt !== null &&
            t >= day.haltStartAt.getTime() &&
            t < day.haltEndAt.getTime();
          expect(status.state).toBe(halted ? 'CLOSED' : 'OPEN');
        }
      }),
    );
  });

  it('다음 갱신 시각은 지금보다 뒤이고 어떤 세션 안의 15분 슬롯 + 소요 시간이다', () => {
    fc.assert(
      fc.property(scenario, ({ days, now, settled }) => {
        const next = marketStatus(now, days, settled).nextUpdateAt;
        // 모두 정산됐고 마지막 세션이 아직 열리기 전이면 갱신 슬롯이 반드시 있다
        const last = days.at(-1)!;
        if (settled === last.tradeDate && last.sessionOpenAt && now < last.sessionOpenAt) {
          expect(next).not.toBeNull();
        }
        if (next === null) return;
        expect(next.getTime()).toBeGreaterThan(now.getTime());
        const slot = new Date(next.getTime() - 60_000);
        expect(slot.getTime() % (15 * 60_000)).toBe(0);
        const session = days.find((d) => d.tradeDate === findSessionDay(slot, days));
        expect(session).toBeDefined();
        // 정지 구간 안의 슬롯은 배치가 돌지 않는다
        const inHalt =
          session!.haltStartAt !== null &&
          slot >= session!.haltStartAt &&
          slot < session!.haltEndAt!;
        expect(inHalt).toBe(false);
      }),
    );
  });
});

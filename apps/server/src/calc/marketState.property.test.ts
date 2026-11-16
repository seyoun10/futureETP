// 속성 기반 테스트(D-129): 임의의 시각·정산 진행에서 장 상태(D-022)와 다음 갱신 시각이 서로 맞는지 본다.
// 달력은 buildTradingDays(D-061)로 만든 실제 형태다: 주말 공백, 전일 휴장, 공휴일 중간 정지(다음 거래일
// 세션에 합쳐짐), 조기 마감, 서머타임 전환(세션 길이 22·23·24시간).
import { readFileSync } from 'node:fs';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  findSessionDay,
  lastClosedTradeDate,
  marketStatus,
  type TradingDaySession,
} from './marketState.ts';
import {
  addDays,
  buildTradingDays,
  DAY_MS,
  type CalendarInput,
  type TradingDayRow,
} from './tradingCalendar.ts';

const realInput = (year: number) =>
  JSON.parse(
    readFileSync(new URL(`../../../../scripts/calendar/${year}.json`, import.meta.url), 'utf8'),
  ) as CalendarInput;

// 무작위 예외 일정. 실제처럼 예외끼리는 붙지 않게 2주에 하나씩만 두고(짝수 주),
// 중간 정지 다음 평일에는 조기 마감이 올 수 있다(추수감사절 다음 날처럼)
const randomInput: fc.Arbitrary<CalendarInput> = fc
  .record({
    year: fc.integer({ min: 2025, max: 2030 }),
    picks: fc.uniqueArray(
      fc.record({
        week: fc.integer({ min: 0, max: 25 }),
        weekday: fc.integer({ min: 0, max: 4 }),
        kind: fc.constantFrom('closed', 'halt', 'haltThenEarly', 'early'),
        at: fc.constantFrom('12:00', '12:45', '13:30', '13:45'),
      }),
      { selector: (p) => p.week, maxLength: 12 },
    ),
  })
  .map(({ year, picks }) => {
    // 그해 첫 월요일부터 센다
    let monday = `${year}-01-01`;
    while (new Date(`${monday}T00:00:00Z`).getUTCDay() !== 1) monday = addDays(monday, 1);
    const input: CalendarInput = { year, closed: [], halts: [], earlyCloses: [] };
    for (const { week, weekday, kind, at } of picks) {
      const date = addDays(monday, week * 14 + weekday);
      const note = kind;
      if (kind === 'closed') input.closed.push({ date, note });
      if (kind === 'early') input.earlyCloses.push({ date, at, note });
      if (kind === 'halt' || kind === 'haltThenEarly') input.halts.push({ date, at, note });
      if (kind === 'haltThenEarly') {
        const next = addDays(date, weekday === 4 ? 3 : 1);
        if (next.startsWith(`${year}-`)) input.earlyCloses.push({ date: next, at: '13:45', note });
      }
    }
    return input;
  });

const HOUR_MS = 3_600_000;

// 한 해 달력에서 연속 거래일 구간을 자른다. 시작점은 아무 곳이나, 또는 예외일·서머타임 전환 근처
const windowOf = ({ input, rows }: { input: CalendarInput; rows: TradingDayRow[] }) => {
  const eventDates = [
    ...input.closed,
    ...input.halts,
    ...input.earlyCloses,
    { date: `${input.year}-03-08` }, // 3월 둘째 일요일 전후(전환일은 3/8~3/14)
    { date: `${input.year}-11-01` }, // 11월 첫 일요일 전후(전환일은 11/1~11/7)
  ].map((e) => e.date);
  const nearEvent = fc
    .record({ date: fc.constantFrom(...eventDates), back: fc.integer({ min: 0, max: 6 }) })
    .map(({ date, back }) => {
      const i = rows.findIndex((r) => r.tradeDate >= date);
      return Math.max(0, (i === -1 ? rows.length : i) - back);
    });
  return fc
    .record({
      start: fc.oneof(fc.integer({ min: 0, max: rows.length - 1 }), nearEvent),
      length: fc.integer({ min: 1, max: 12 }),
      // 첫 행을 세션 없는 과거 행(D-048)으로
      legacy: fc.boolean(),
    })
    .map(({ start, length, legacy }) =>
      rows.slice(start, start + length).map((r, i): TradingDaySession => ({
        tradeDate: r.tradeDate,
        sessionOpenAt: legacy && i === 0 ? null : r.sessionOpenAt,
        sessionCloseAt: legacy && i === 0 ? null : r.sessionCloseAt,
        haltStartAt: legacy && i === 0 ? null : r.haltStartAt,
        haltEndAt: legacy && i === 0 ? null : r.haltEndAt,
      })),
    );
};

// 한 해 달력 생성은 실행마다 하기엔 무거워(Intl 변환) 모듈 로드 때 고정 시드로 한 번 만든다
const CALENDARS = [
  realInput(2026),
  realInput(2027),
  ...fc.sample(randomInput, { numRuns: 8, seed: 129 }),
].map((input) => ({ input, rows: buildTradingDays(input) }));

const calendar = fc
  .constantFrom(...CALENDARS)
  .chain(windowOf)
  .filter((days) => days.length > 0);

const nearAny = (edges: number[]) =>
  fc
    .record({
      edge: fc.constantFrom(...edges),
      delta: fc.integer({ min: -2 * HOUR_MS, max: 2 * HOUR_MS }),
    })
    .map(({ edge, delta }) => edge + delta);

const scenario = calendar.chain((days) => {
  const first = Date.parse(`${days[0]!.tradeDate}T00:00:00Z`) - 2 * DAY_MS;
  const last = Date.parse(`${days.at(-1)!.tradeDate}T00:00:00Z`) + 2 * DAY_MS;
  const times = (pick: (d: TradingDaySession) => (Date | null)[]) =>
    days.flatMap((d) => pick(d).flatMap((x) => (x ? [x.getTime()] : [])));
  const sessionEdges = times((d) => [d.sessionOpenAt, d.sessionCloseAt]);
  const haltEdges = times((d) => [d.haltStartAt, d.haltEndAt]);
  // 아무 시각, 세션 경계 근처, 정지 구간 근처(있으면)를 고르게 뽑는다
  const now = fc.oneof(
    fc.integer({ min: first, max: last }),
    nearAny([first, ...sessionEdges]),
    ...(haltEdges.length > 0 ? [nearAny(haltEdges)] : []),
  );
  return fc.record({
    days: fc.constant(days),
    now: now.map((t) => new Date(t)),
    settled: fc.option(fc.constantFrom(...days.map((d) => d.tradeDate)), { nil: null }),
  });
});

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

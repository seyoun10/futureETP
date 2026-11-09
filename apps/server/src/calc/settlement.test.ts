import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { TradingDaySession } from './marketState.ts';
import {
  MAX_CATCH_UP_DAYS,
  findRevisedBars,
  planSettle,
  revisionTradeDate,
  type BarValues,
} from './settlement.ts';
import {
  CME_TIME_ZONE,
  buildTradingDays,
  zonedTimeToUtc,
  type CalendarInput,
} from './tradingCalendar.ts';

const days: TradingDaySession[] = buildTradingDays(
  JSON.parse(
    readFileSync(new URL('../../../../scripts/calendar/2026.json', import.meta.url), 'utf8'),
  ) as CalendarInput,
);

const ct = (date: string, time: string) => zonedTimeToUtc(date, time, CME_TIME_ZONE);

describe('planSettle', () => {
  it('18:30 CT에는 그날 거래일을 받는다', () => {
    expect(planSettle(ct('2026-10-27', '18:30'), days, '2026-10-26')).toEqual({
      tradeDate: '2026-10-27',
      dates: ['2026-10-27'],
    });
  });

  it('정산 작업 시각(16:05 CT, 마감 뒤)에도 그날 거래일을 받고, 마감 전이면 전 거래일이다(D-101)', () => {
    expect(planSettle(ct('2026-10-27', '16:05'), days, '2026-10-26').dates).toEqual(['2026-10-27']);
    expect(planSettle(ct('2026-10-27', '15:59'), days, '2026-10-26').dates).toEqual([]);
  });

  it('정산 이력이 없으면 가장 최근 거래일만 받는다', () => {
    expect(planSettle(ct('2026-10-27', '18:30'), days, null).dates).toEqual(['2026-10-27']);
  });

  it('이미 정산한 거래일이면 받을 날이 없다(평일 휴장일 트리거)', () => {
    // 2026-11-26 추수감사절 휴장: 18:30 CT 기준 마지막으로 끝난 세션은 11-25
    expect(planSettle(ct('2026-11-26', '18:30'), days, '2026-11-25')).toEqual({
      tradeDate: '2026-11-25',
      dates: [],
    });
  });

  it('밀린 거래일을 오름차순으로 따라잡는다(주말 건너뜀)', () => {
    expect(planSettle(ct('2026-10-27', '18:30'), days, '2026-10-22').dates).toEqual([
      '2026-10-23',
      '2026-10-26',
      '2026-10-27',
    ]);
  });

  it(`밀린 거래일이 ${MAX_CATCH_UP_DAYS}일을 넘으면 실패한다`, () => {
    expect(() => planSettle(ct('2026-10-27', '18:30'), days, '2026-10-16')).toThrow(/exceed/);
  });

  it('마지막 정산일이 넘겨받은 달력보다 앞이면 실패한다', () => {
    expect(() => planSettle(ct('2026-10-27', '18:30'), days.slice(200), '2026-01-05')).toThrow(
      /not loaded/,
    );
  });

  it('끝난 세션이 없으면 실패한다', () => {
    expect(() => planSettle(ct('2025-12-01', '18:30'), days, null)).toThrow(/No closed/);
  });
});

describe('revisionTradeDate', () => {
  it('가장 최근에 끝난 거래일의 직전 거래일이다', () => {
    expect(revisionTradeDate(ct('2026-10-27', '18:30'), days)).toBe('2026-10-26');
    expect(revisionTradeDate(ct('2026-10-26', '18:30'), days)).toBe('2026-10-23');
  });

  it('직전 행이 없으면 null', () => {
    expect(revisionTradeDate(ct('2026-01-02', '18:30'), days)).toBeNull();
  });
});

describe('findRevisedBars', () => {
  const bar = (contractSymbol: string, settle: number, volume = 100): BarValues => ({
    contractSymbol,
    open: 1,
    high: 2,
    low: 0.5,
    settle,
    volume,
  });

  it('값이 바뀐 월물만 다시 받은 값으로 돌려준다', () => {
    const stored = [bar('CLZ26', 75), bar('CLF27', 76), bar('CLG27', 77)];
    const fetched = [bar('CLZ26', 75), bar('CLF27', 76.1), bar('CLG27', 77, 120)];
    expect(findRevisedBars(stored, fetched)).toEqual([
      { before: bar('CLF27', 76), after: bar('CLF27', 76.1) },
      { before: bar('CLG27', 77), after: bar('CLG27', 77, 120) },
    ]);
  });

  it('소스가 비워 보낸 OHLC·거래량만 다르면 정정이 아니다', () => {
    const empty = { ...bar('CLZ26', 75), open: null, high: null, low: null, volume: 0 };
    expect(findRevisedBars([bar('CLZ26', 75)], [empty])).toEqual([]);
  });

  it('다른 값이 바뀌어도 비워 보낸 값은 저장된 값을 남긴다', () => {
    const fetched = { ...bar('CLZ26', 75.5), open: null, volume: 0 };
    expect(findRevisedBars([bar('CLZ26', 75)], [fetched])).toEqual([
      { before: bar('CLZ26', 75), after: bar('CLZ26', 75.5) },
    ]);
  });

  it('저장된 값이 비어 있으면 받은 값으로 채운다', () => {
    const stored = { ...bar('CLZ26', 75), open: null, volume: 0 };
    expect(findRevisedBars([stored], [bar('CLZ26', 75)])).toEqual([
      { before: stored, after: bar('CLZ26', 75) },
    ]);
  });

  it('저장되지 않은 월물과 소스에서 빠진 월물은 무시한다', () => {
    expect(findRevisedBars([bar('CLZ26', 75)], [bar('CLF27', 76)])).toEqual([]);
    expect(findRevisedBars([bar('CLZ26', 75)], [])).toEqual([]);
  });
});

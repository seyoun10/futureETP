import { describe, expect, it } from 'vitest';
import {
  buildTradingDays,
  zonedTimeToUtc,
  type CalendarInput,
  type TradingDayRow,
} from './tradingCalendar.ts';

const empty: CalendarInput = { year: 2026, closed: [], halts: [], earlyCloses: [] };

const input2026: CalendarInput = {
  year: 2026,
  closed: [
    { date: '2026-01-01', note: "New Year's Day" },
    { date: '2026-04-03', note: 'Good Friday' },
    { date: '2026-12-25', note: 'Christmas Day' },
  ],
  halts: [
    { date: '2026-01-19', at: '13:30', note: 'Martin Luther King Jr. Day' },
    { date: '2026-07-03', at: '13:30', note: 'Independence Day (observed)' },
    { date: '2026-09-07', at: '12:00', note: 'Labor Day' },
    { date: '2026-11-26', at: '13:30', note: 'Thanksgiving Day' },
  ],
  earlyCloses: [{ date: '2026-11-27', at: '12:45', note: 'Day after Thanksgiving' }],
};

const byDate = (rows: TradingDayRow[]) => new Map(rows.map((r) => [r.tradeDate, r]));
const iso = (d: Date | null) => d?.toISOString() ?? null;

describe('zonedTimeToUtc', () => {
  it('CT 겨울(CST, UTC-6)과 여름(CDT, UTC-5)을 구분한다', () => {
    expect(zonedTimeToUtc('2026-01-05', '17:00', 'America/Chicago').toISOString()).toBe(
      '2026-01-05T23:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-07-06', '16:00', 'America/Chicago').toISOString()).toBe(
      '2026-07-06T21:00:00.000Z',
    );
  });

  it('서머타임 전환 당일 저녁은 새 오프셋을 쓴다', () => {
    // 2026-03-08 02:00 CST → CDT
    expect(zonedTimeToUtc('2026-03-08', '17:00', 'America/Chicago').toISOString()).toBe(
      '2026-03-08T22:00:00.000Z',
    );
  });
});

describe('buildTradingDays', () => {
  it('예외가 없으면 평일 전부가 정규 세션 거래일이다', () => {
    const rows = buildTradingDays(empty);
    expect(rows).toHaveLength(261);
    const mon = byDate(rows).get('2026-10-26');
    expect(mon).toEqual({
      tradeDate: '2026-10-26',
      sessionOpenAt: new Date('2026-10-25T22:00:00Z'), // 일 17:00 CDT
      sessionCloseAt: new Date('2026-10-26T21:00:00Z'), // 월 16:00 CDT
      haltStartAt: null,
      haltEndAt: null,
      isEarlyClose: false,
      note: null,
    });
    expect(iso(byDate(rows).get('2026-10-27')!.sessionOpenAt)).toBe('2026-10-26T22:00:00.000Z');
  });

  it('전일 휴장·중간 정지일은 행이 없다', () => {
    const days = byDate(buildTradingDays(input2026));
    for (const d of ['2026-01-01', '2026-04-03', '2026-12-25', '2026-01-19', '2026-11-26']) {
      expect(days.has(d)).toBe(false);
    }
    expect(days.size).toBe(261 - 7);
  });

  it('휴장일 다음 거래일은 휴장일 17:00에 개장한다', () => {
    const jan2 = byDate(buildTradingDays(input2026)).get('2026-01-02')!;
    expect(iso(jan2.sessionOpenAt)).toBe('2026-01-01T23:00:00.000Z');
    expect(jan2.haltStartAt).toBeNull();
  });

  it('월요일 중간 정지는 화요일 거래일에 합쳐진다(일 17:00 개장, 월 13:30~17:00 정지)', () => {
    const tue = byDate(buildTradingDays(input2026)).get('2026-01-20')!;
    expect(iso(tue.sessionOpenAt)).toBe('2026-01-18T23:00:00.000Z');
    expect(iso(tue.haltStartAt)).toBe('2026-01-19T19:30:00.000Z');
    expect(iso(tue.haltEndAt)).toBe('2026-01-19T23:00:00.000Z');
    expect(iso(tue.sessionCloseAt)).toBe('2026-01-20T22:00:00.000Z');
    expect(tue.note).toBe('Martin Luther King Jr. Day');
  });

  it('노동절은 12:00 CT에 정지한다', () => {
    const tue = byDate(buildTradingDays(input2026)).get('2026-09-08')!;
    expect(iso(tue.haltStartAt)).toBe('2026-09-07T17:00:00.000Z');
  });

  it('금요일 중간 정지는 월요일 거래일에 합쳐지고 일요일 17:00에 재개한다', () => {
    const mon = byDate(buildTradingDays(input2026)).get('2026-07-06')!;
    expect(iso(mon.sessionOpenAt)).toBe('2026-07-02T22:00:00.000Z'); // 목 17:00 CDT
    expect(iso(mon.haltStartAt)).toBe('2026-07-03T18:30:00.000Z'); // 금 13:30 CDT
    expect(iso(mon.haltEndAt)).toBe('2026-07-05T22:00:00.000Z'); // 일 17:00 CDT
  });

  it('추수감사절 다음 날은 수요일 개장·목요일 정지·12:45 조기 마감이다', () => {
    const fri = byDate(buildTradingDays(input2026)).get('2026-11-27')!;
    expect(fri).toEqual({
      tradeDate: '2026-11-27',
      sessionOpenAt: new Date('2026-11-25T23:00:00Z'),
      sessionCloseAt: new Date('2026-11-27T18:45:00Z'),
      haltStartAt: new Date('2026-11-26T19:30:00Z'),
      haltEndAt: new Date('2026-11-26T23:00:00Z'),
      isEarlyClose: true,
      note: 'Thanksgiving Day; Day after Thanksgiving',
    });
  });

  it.each<[string, Partial<CalendarInput>, RegExp]>([
    ['주말', { closed: [{ date: '2026-10-31', note: 'x' }] }, /weekend/],
    ['다른 연도', { closed: [{ date: '2027-01-01', note: 'x' }] }, /outside 2026/],
    ['없는 날짜', { closed: [{ date: '2026-02-30', note: 'x' }] }, /Invalid date/],
    [
      '중복',
      {
        closed: [{ date: '2026-12-25', note: 'x' }],
        earlyCloses: [{ date: '2026-12-25', at: '12:00', note: 'y' }],
      },
      /Duplicate/,
    ],
    ['잘못된 시각', { halts: [{ date: '2026-01-19', at: '1:30', note: 'x' }] }, /Invalid time/],
  ])('%s 예외는 실패한다', (_, patch, error) => {
    expect(() => buildTradingDays({ ...empty, ...patch })).toThrow(error);
  });
});

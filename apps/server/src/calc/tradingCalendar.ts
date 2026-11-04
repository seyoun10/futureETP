// CME 에너지·금속 거래일 달력 생성(research/cme-calendar.md, D-061).
// 입력은 그해 예외 일정(전일 휴장·공휴일 중간 정지·조기 마감)뿐이고, 나머지 평일은 정규 세션이다.
// 정규 세션: 전날 17:00 ~ 당일 16:00 CT. 중간 정지일은 거래일이 아니고 그 세션은 다음 거래일에 합쳐진다.

export const CME_TIME_ZONE = 'America/Chicago';
// 국내 ETP(KRX)·미국 ETP 거래소 시간대. ETP 작업 기준일을 이 시간대 날짜로 정한다
export const KRX_TIME_ZONE = 'Asia/Seoul';
export const US_EQUITY_TIME_ZONE = 'America/New_York';
const SESSION_OPEN = '17:00';
const SESSION_CLOSE = '16:00';

export type CalendarException = { date: string; note: string };
export type TimedException = CalendarException & { at: string };

export type CalendarInput = {
  year: number;
  closed: CalendarException[];
  halts: TimedException[];
  earlyCloses: TimedException[];
};

export type TradingDayRow = {
  tradeDate: string;
  sessionOpenAt: Date;
  sessionCloseAt: Date;
  haltStartAt: Date | null;
  haltEndAt: Date | null;
  isEarlyClose: boolean;
  note: string | null;
};

// 'YYYY-MM-DD'에 일 수를 더한다.
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isWeekend(date: string): boolean {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 || dow === 6;
}

function previousWeekday(date: string): string {
  let d = addDays(date, -1);
  while (isWeekend(d)) d = addDays(d, -1);
  return d;
}

// 시간대 벽시계 시각 → UTC. 17:00·13:30처럼 서머타임 전환 구간(02~03시)이 아닌 시각만 쓴다.
export function zonedTimeToUtc(date: string, time: string, timeZone: string): Date {
  const wall = Date.parse(`${date}T${time}:00Z`);
  const offsetAt = (utcMs: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).formatToParts(utcMs);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    const asUtc = Date.UTC(
      get('year'),
      get('month') - 1,
      get('day'),
      get('hour'),
      get('minute'),
      get('second'),
    );
    return asUtc - utcMs;
  };
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first));
}

const ct = (date: string, time: string) => zonedTimeToUtc(date, time, CME_TIME_ZONE);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function validate(input: CalendarInput): void {
  const seen = new Set<string>();
  const all = [
    ...input.closed.map((e) => ({ ...e, at: undefined })),
    ...input.halts,
    ...input.earlyCloses,
  ];
  for (const e of all) {
    if (!DATE.test(e.date) || addDays(e.date, 0) !== e.date) {
      throw new Error(`Invalid date: ${e.date}`);
    }
    if (!e.date.startsWith(`${input.year}-`))
      throw new Error(`Date outside ${input.year}: ${e.date}`);
    if (isWeekend(e.date)) throw new Error(`Exception on weekend: ${e.date}`);
    if (seen.has(e.date)) throw new Error(`Duplicate exception: ${e.date}`);
    if (e.at !== undefined && !TIME.test(e.at))
      throw new Error(`Invalid time: ${e.at} (${e.date})`);
    seen.add(e.date);
  }
}

export function buildTradingDays(input: CalendarInput): TradingDayRow[] {
  validate(input);
  const closed = new Set(input.closed.map((e) => e.date));
  const halts = new Map(input.halts.map((e) => [e.date, e]));
  const earlyCloses = new Map(input.earlyCloses.map((e) => [e.date, e]));

  const rows: TradingDayRow[] = [];
  for (
    let date = `${input.year}-01-01`;
    date.startsWith(`${input.year}-`);
    date = addDays(date, 1)
  ) {
    if (isWeekend(date) || closed.has(date) || halts.has(date)) continue;

    // 직전 평일이 중간 정지일이면 그 정지일 전날 저녁 개장분부터 이 거래일 세션이다.
    // 재개는 이 거래일의 정규 개장 시각이다(금요일 정지면 일요일 17:00).
    const regularOpenDate = addDays(date, -1);
    const halt = halts.get(previousWeekday(date));
    const openDate = halt ? addDays(halt.date, -1) : regularOpenDate;

    const early = earlyCloses.get(date);
    const notes = [halt?.note, early?.note].filter((n): n is string => n !== undefined);
    rows.push({
      tradeDate: date,
      sessionOpenAt: ct(openDate, SESSION_OPEN),
      sessionCloseAt: ct(date, early?.at ?? SESSION_CLOSE),
      haltStartAt: halt ? ct(halt.date, halt.at) : null,
      haltEndAt: halt ? ct(regularOpenDate, SESSION_OPEN) : null,
      isEarlyClose: early !== undefined,
      note: notes.length > 0 ? notes.join('; ') : null,
    });
  }
  return rows;
}

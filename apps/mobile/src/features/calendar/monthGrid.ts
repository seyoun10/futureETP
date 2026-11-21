// 휴장 달력 화면의 달·칸 계산. 날짜는 모두 기기 로컬 기준 'YYYY-MM-DD'다.

export type CalendarMonth = { year: number; month: number };

const pad = (n: number) => String(n).padStart(2, '0');

export const dateKey = (year: number, month: number, day: number): string =>
  `${year}-${pad(month)}-${pad(day)}`;

export const localDateKey = (at: Date): string =>
  dateKey(at.getFullYear(), at.getMonth() + 1, at.getDate());

// today가 속한 달부터 count개월
export function monthsFrom(today: Date, count: number): CalendarMonth[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });
}

const daysInMonth = ({ year, month }: CalendarMonth) => new Date(year, month, 0).getDate();

// 첫 달 1일 ~ 마지막 달 말일
export function monthsRange(months: readonly CalendarMonth[]): { from: string; to: string } {
  const first = months[0];
  const last = months[months.length - 1];
  if (!first || !last) throw new Error('months must not be empty');
  return {
    from: dateKey(first.year, first.month, 1),
    to: dateKey(last.year, last.month, daysInMonth(last)),
  };
}

// 일요일 시작 주 단위 칸. 그 달이 아닌 칸은 null이고, 길이는 7의 배수다
export function monthCells(month: CalendarMonth): (string | null)[] {
  const lead = new Date(month.year, month.month - 1, 1).getDay();
  const days = daysInMonth(month);
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) cells.push(dateKey(month.year, month.month, day));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// 'YYYY-MM-DD'의 요일(0 = 일요일). 시간대와 상관없게 UTC로 센다
export const weekdayOf = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

// 시각·거래일 표시 포맷. 언어와 상관없이 숫자 형식(MM/DD HH:mm)을 쓴다(screens.md 기준 시각 줄).

// UTC ISO 시각 → 기기 현지(테스트는 timeZone 지정) `MM/DD HH:mm`
export function formatLocalDateTime(iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('month')}/${part('day')} ${part('hour')}:${part('minute')}`;
}

// CME 거래일 `YYYY-MM-DD` → `MM/DD`. 달력 날짜라 시간대 변환을 하지 않는다.
export const formatTradeDate = (tradeDate: string): string =>
  `${tradeDate.slice(5, 7)}/${tradeDate.slice(8, 10)}`;

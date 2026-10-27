// 보이는 봉 구간에서 월 경계 x축 눈금을 고른다(D-032 스파이크).
// 1월은 연도, 나머지는 월 숫자를 라벨로 쓴다(screens.md C-a의 "11월 2026 3월").

export type MonthTick = { index: number; label: string };

const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 48];
const TRADING_DAYS_PER_MONTH = 21;

export function monthTicks(dates: string[], i0: number, i1: number, maxTicks = 5): MonthTick[] {
  const visibleMonths = (i1 - i0 + 1) / TRADING_DAYS_PER_MONTH;
  const step =
    MONTH_STEPS.find((s) => visibleMonths / s <= maxTicks) ?? MONTH_STEPS[MONTH_STEPS.length - 1];
  const ticks: MonthTick[] = [];
  for (let i = Math.max(i0, 1); i <= i1; i++) {
    const prev = dates[i - 1];
    const cur = dates[i];
    if (!prev || !cur || prev.slice(0, 7) === cur.slice(0, 7)) continue;
    const year = Number(cur.slice(0, 4));
    const month = Number(cur.slice(5, 7));
    const serial = year * 12 + (month - 1);
    if (serial % step !== 0) continue;
    ticks.push({ index: i, label: month === 1 ? String(year) : `${month}월` });
  }
  return ticks;
}

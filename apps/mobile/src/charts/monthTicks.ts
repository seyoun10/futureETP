import type { TFunction } from 'i18next';

// 보이는 봉 구간에서 월 경계 x축 눈금을 고른다(D-056).
// 라벨은 monthTickLabel로 만든다. 1월은 연도, 나머지는 월(screens.md C-a의 "11월 2026 3월").

export type MonthTick = { index: number; year: number; month: number };

const MONTH_STEPS = [1, 2, 3, 6, 12, 24, 48];

// 라벨이 겹치지 않는 가장 촘촘한 월 간격의 눈금. minGap은 이웃 눈금 사이 최소 봉 수(라벨 너비 + 여백 / 봉 간격)
export function monthTicks(
  dates: readonly string[],
  i0: number,
  i1: number,
  minGap: number,
): MonthTick[] {
  const boundaries: MonthTick[] = [];
  for (let i = Math.max(i0, 1); i <= i1; i++) {
    const prev = dates[i - 1];
    const cur = dates[i];
    if (!prev || !cur || prev.slice(0, 7) === cur.slice(0, 7)) continue;
    boundaries.push({ index: i, year: Number(cur.slice(0, 4)), month: Number(cur.slice(5, 7)) });
  }
  let ticks: MonthTick[] = [];
  for (const step of MONTH_STEPS) {
    ticks = boundaries.filter((t) => (t.year * 12 + (t.month - 1)) % step === 0);
    if (ticks.every((t, j) => j === 0 || t.index - ticks[j - 1].index >= minGap)) break;
  }
  return ticks;
}

// 1월은 연도, 나머지는 월 이름. C-a·C-c x축과 C-b 월물 라벨이 같이 쓴다
export const monthTickLabel = (t: TFunction, year: number, month: number): string =>
  month === 1
    ? String(year)
    : t(`chart.months.${String(month) as '1'}`, { defaultValue: String(month) });

// 1월(연도)을 포함한 모든 월 라벨 중 가장 넓은 너비. 겹침 판정은 이 너비로 한다
export const widestMonthLabel = (t: TFunction, measure: (label: string) => number): number =>
  Math.max(...Array.from({ length: 12 }, (_, m) => measure(monthTickLabel(t, 2000, m + 1))));

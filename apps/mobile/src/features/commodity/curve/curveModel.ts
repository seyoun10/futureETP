import type { Curve, CurveStats } from '@futureetp/shared';
import type { useTranslation } from 'react-i18next';
import { formatChange, formatContractMonth } from '@/lib/formatNumber';

// 기준일 버튼은 멀리 옮길 수 있어 연도를 항상 쓴다(screens.md C-b 버튼)
export const formatFullDate = (date: string): string => date.replaceAll('-', '/');

// 범례 줄 기준일: D와 같은 해면 `MM/DD`, 아니면 `YYYY/MM/DD`(screens.md C-b 기준일 선택 시트)
export const formatLegendDate = (date: string, currentDate: string): string =>
  date.slice(0, 4) === currentDate.slice(0, 4)
    ? formatFullDate(date).slice(5)
    : formatFullDate(date);

// OS 날짜 피커는 기기 시간대 Date를 쓴다. 날짜만 오가므로 기기 시간대 자정으로 바꾼다.
export const toPickerDate = (date: string): Date => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const fromPickerDate = (date: Date): string =>
  [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((n) => String(n).padStart(2, '0'))
    .join('-');

// 휴장일 안내의 요일(`10/16(금)`). 날짜만이라 UTC로 센다.
export const formatWeekday = (date: string, language: string): string =>
  new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );

// 차트 점·툴팁 변화율. 커브는 점이 많아 소수 첫째 자리까지
export const CURVE_PCT_DECIMALS = 1;
export const formatCurvePct = (pct: number): string => `${formatChange(pct, CURVE_PCT_DECIMALS)}%`;

type T = ReturnType<typeof useTranslation>['t'];

const perYear = (t: T, stats: CurveStats | null) =>
  stats ? t('curve.perYear', { pct: formatCurvePct(stats.rollYieldPct) }) : t('curve.unavailable');

// 수치 요약 두 줄: 커브 상태·M1→M2 스프레드, 롤 수익률(기준일 값 함께)
export function curveSummaryLines(t: T, data: Curve): [string, string] {
  const { current, base } = data;
  const state = current
    ? t('curve.stateLine', {
        state: t(`curve.state.${current.state}`),
        m1: formatContractMonth(current.m1ContractMonth),
        m2: formatContractMonth(current.m2ContractMonth),
        spread: formatCurvePct(current.spreadPct),
      })
    : t('curve.stateUnavailable');
  return [state, t('curve.rollYield', { value: perYear(t, current), base: perYear(t, base) })];
}

import { formatPrice } from './formatNumber';

// 순자산·거래대금 같은 큰 금액을 단위로 줄인다(screens.md C-d 예: `1,234억 원`, `$12.3M`).
// 통화 표기는 i18n(etp.amount)이 붙인다. 단위는 월물 표기처럼 숫자 표기로 보고 여기 둔다.
export type AmountScheme = 'eok' | 'si';

const UNITS: Record<AmountScheme, readonly [string, number][]> = {
  // 억·만은 정수(1,234억), 그 아래는 원 단위
  eok: [
    ['억', 1e8],
    ['만', 1e4],
  ],
  // T·B·M·K는 소수 한 자리(12.3M)
  si: [
    ['T', 1e12],
    ['B', 1e9],
    ['M', 1e6],
    ['K', 1e3],
  ],
};

export function compactAmount(value: number, scheme: AmountScheme): string {
  const decimals = scheme === 'eok' ? 0 : 1;
  const units = UNITS[scheme];
  const index = units.findIndex(([, size]) => Math.abs(value) >= size);
  if (index === -1) return formatPrice(value, 0);
  const [unit, size] = units[index];
  const upper = units[index - 1];
  // 반올림해서 위 단위에 닿으면(9,999.6만 → 10,000만) 위 단위로 쓴다(1억)
  const rounded = Math.abs(Number((value / size).toFixed(decimals)));
  if (upper && rounded >= upper[1] / size) {
    return `${formatPrice(value / upper[1], decimals)}${upper[0]}`;
  }
  return `${formatPrice(value / size, decimals)}${unit}`;
}

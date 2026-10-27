// 시세 숫자 표시. 언어와 상관없이 `2,405.1`·`+12.2`·`-1.04%` 형식이다(screens.md A).
// Hermes Intl 지원 범위에 기대지 않도록 직접 만든다.

// 천 단위 쉼표 + 고정 소수 자릿수. 차트 십자선이 UI 스레드에서도 부른다
export function formatPrice(value: number, decimals: number): string {
  'worklet';
  const [int, frac] = Math.abs(value).toFixed(decimals).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  // 반올림해 0이면 부호를 붙이지 않는다(worklet은 바깥 함수를 부르기 까다로워 안에 둔다)
  const sign = value < 0 && !/^0*$/.test(int + (frac ?? '')) ? '-' : '';
  return `${sign}${grouped}${frac === undefined ? '' : `.${frac}`}`;
}

// 부호 붙인 변화량. 반올림해서 0이면 부호를 붙이지 않는다.
export function formatChange(value: number, decimals: number): string {
  const abs = formatPrice(Math.abs(value), decimals);
  if (/^[0.,]+$/.test(abs)) return abs;
  return `${value < 0 ? '-' : '+'}${abs}`;
}

// 등락률(%) 소수 둘째 자리
export const formatChangePct = (pct: number): string => `${formatChange(pct, 2)}%`;

// 월물 `YYYY-MM` → `DEC26`(CME 월물 표기라 언어와 상관없다)
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
export const formatContractMonth = (contractMonth: string): string =>
  `${MONTHS[Number(contractMonth.slice(5, 7)) - 1]}${contractMonth.slice(2, 4)}`;

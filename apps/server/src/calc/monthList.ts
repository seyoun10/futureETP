// 대상 월물 판정과 홈(A)·월물차트(C-c)의 월물 목록(product.md 월물 목록, D-063).

// 홈·월물차트에 쓰는 만기순 월물 개수
export const MONTH_LIST_SIZE = 5;

// active_month_rule 행(원자재 하나)
export type ActiveMonthRule = {
  validFrom: string;
  // null = 현재
  validTo: string | null;
  // 1~12
  months: readonly number[];
};

// contract 행 중 목록 선택에 쓰는 값
export type ListedContract = {
  symbol: string;
  // YYYY-MM
  contractMonth: string;
  lastTradeDate: string;
  isTarget: boolean;
};

// contract.is_target 계산. 규칙이 없는 원자재(에너지)는 모든 월물이 대상이다.
// 금속은 월물 첫날이 기간에 들어가는 규칙의 활성 월물만 대상이다.
export function isTargetMonth(contractMonth: string, rules: readonly ActiveMonthRule[]): boolean {
  if (rules.length === 0) return true;
  const firstDay = `${contractMonth}-01`;
  const rule = rules.find(
    (r) => r.validFrom <= firstDay && (r.validTo === null || firstDay <= r.validTo),
  );
  return rule?.months.includes(Number(contractMonth.slice(5, 7))) ?? false;
}

// 만기순(최종 거래일, 같으면 월물). 월물 목록·대표월물·커브가 함께 쓴다
export const byExpiry = (
  a: Pick<ListedContract, 'lastTradeDate' | 'contractMonth'>,
  b: Pick<ListedContract, 'lastTradeDate' | 'contractMonth'>,
) =>
  a.lastTradeDate.localeCompare(b.lastTradeDate) || a.contractMonth.localeCompare(b.contractMonth);

// tradeDate(표시 데이터가 속한 거래일, marketStatus.tradeDate)에 아직 만기되지 않은 대상 월물을
// 만기순으로 5개 고른다. 최종 거래일 당일까지 남고 다음 거래일에 빠진다.
// 대표월물이 그 안에 없으면 6번째로 덧붙인다(안전장치).
export function selectMonthList<T extends ListedContract>(
  contracts: readonly T[],
  tradeDate: string,
  frontSymbol: string | null,
): T[] {
  const list = contracts
    .filter((c) => c.isTarget && c.lastTradeDate >= tradeDate)
    .sort(byExpiry)
    .slice(0, MONTH_LIST_SIZE);
  if (frontSymbol !== null && !list.some((c) => c.symbol === frontSymbol)) {
    const front = contracts.find((c) => c.symbol === frontSymbol);
    if (front) list.push(front);
  }
  return list;
}

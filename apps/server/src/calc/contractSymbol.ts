// 월물 표준 심볼(D-049): 루트 + 월 코드 + 연도 2자리, 예: CLZ26.
// DB·API·화면은 이 형식만 쓴다. 소스별 표기 변환은 각 수집기(sources/)가 한다.
import { COMMODITY_CODES, type CommodityCode } from '@futureetp/shared';

// CME 월 코드. 인덱스 0 = 1월
export const MONTH_CODES = ['F', 'G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z'] as const;

export type ParsedContractSymbol = {
  commodityCode: CommodityCode;
  // YYYY-MM
  contractMonth: string;
};

const CONTRACT_MONTH = /^20(\d{2})-(0[1-9]|1[0-2])$/;
const SYMBOL = new RegExp(`^(${COMMODITY_CODES.join('|')})([${MONTH_CODES.join('')}])(\\d{2})$`);

export function toContractSymbol(commodityCode: CommodityCode, contractMonth: string): string {
  const match = CONTRACT_MONTH.exec(contractMonth);
  if (!match) throw new Error(`Invalid contract month: ${contractMonth}`);
  const [, yy, mm] = match;
  return `${commodityCode}${MONTH_CODES[Number(mm) - 1]}${yy}`;
}

// 연도 2자리는 2000년대로 읽는다(적재 시작 2010-06, D-020).
export function parseContractSymbol(symbol: string): ParsedContractSymbol {
  const match = SYMBOL.exec(symbol);
  if (!match) throw new Error(`Invalid contract symbol: ${symbol}`);
  const [, code, monthCode, yy] = match;
  const month = MONTH_CODES.indexOf(monthCode as (typeof MONTH_CODES)[number]) + 1;
  return {
    commodityCode: code as CommodityCode,
    contractMonth: `20${yy}-${String(month).padStart(2, '0')}`,
  };
}

// dev 전용 가짜 정산 소스(D-071). 날짜·월물로 정해지는 값이라 다시 받아도 같다(정정 없음).
// 실소스 연결(5-4) 전까지 DAILY_SETTLE 흐름을 dev DB에서 돌려 보는 데 쓴다.
import type { CommodityCode } from '@futureetp/shared';
import { addDays } from '../calc/tradingCalendar.ts';
import { parseContractSymbol, toContractSymbol } from '../calc/contractSymbol.ts';
import type { ContractDefinition, SettlementSource, SourceBar } from './settlement.ts';

const BASE_PRICE: Record<CommodityCode, number> = { GC: 2400, SI: 30, CL: 75, NG: 3 };
const DECIMALS: Record<CommodityCode, number> = { GC: 1, SI: 3, CL: 2, NG: 3 };
// 상장 월물 수(이번 달부터)
const LISTED_MONTHS = 24;
const DAY_MS = 86_400_000;

const monthOffset = (contractMonth: string, months: number) => {
  const [y, m] = contractMonth.split('-').map(Number);
  const total = y * 12 + (m - 1) + months;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
};

// 최종 거래일은 전월 20일로 둔다(실제 규칙과 다르다)
const fakeLastTradeDate = (contractMonth: string) => `${monthOffset(contractMonth, -1)}-20`;

const dayNumber = (date: string) => Date.parse(`${date}T00:00:00Z`) / DAY_MS;

const round = (value: number, decimals: number) => Number(value.toFixed(decimals));

function fakeBar(code: CommodityCode, symbol: string, tradeDate: string): SourceBar {
  const { contractMonth } = parseContractSymbol(symbol);
  const t = dayNumber(tradeDate);
  const daysToExpiry = dayNumber(fakeLastTradeDate(contractMonth)) - t;
  // 완만한 추세 + 만기가 멀수록 비싼 콘탱고
  const settle = BASE_PRICE[code] * (1 + 0.1 * Math.sin(t / 30)) * (1 + 0.0002 * daysToExpiry);
  const d = DECIMALS[code];
  // 만기 10~50일 앞 월물에 거래가 몰려 대표월물이 옮겨 간다
  const volume = Math.round(200_000 * Math.exp(-(((daysToExpiry - 30) / 25) ** 2))) + 10;
  return {
    contractSymbol: symbol,
    open: round(settle * 0.995, d),
    high: round(settle * 1.01, d),
    low: round(settle * 0.99, d),
    settle: round(settle, d),
    volume,
  };
}

export function createFakeSettlementSource(): SettlementSource {
  return {
    name: 'FAKE',
    listContracts(code, tradeDate) {
      const first = tradeDate.slice(0, 7);
      const contracts: ContractDefinition[] = [];
      for (let i = 0; i < LISTED_MONTHS; i++) {
        const contractMonth = monthOffset(first, i);
        const lastTradeDate = fakeLastTradeDate(contractMonth);
        if (lastTradeDate < tradeDate) continue;
        contracts.push({
          symbol: toContractSymbol(code, contractMonth),
          contractMonth,
          firstTradeDate: addDays(lastTradeDate, -LISTED_MONTHS * 31),
          lastTradeDate,
        });
      }
      return Promise.resolve(contracts);
    },
    fetchDailyBars(code, symbols, tradeDate) {
      return Promise.resolve(symbols.map((symbol) => fakeBar(code, symbol, tradeDate)));
    },
  };
}

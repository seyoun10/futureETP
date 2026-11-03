// 일일 정산 소스 인터페이스(D-071). 실소스(Massive, 5-4)와 dev 가짜 소스(fakeSettlement.ts)가 구현한다.
// 심볼은 표준 심볼(D-049)이고, 소스별 표기 변환은 구현이 한다.
import type { CommodityCode } from '@futureetp/shared';
import type { Source } from '../constants.ts';

// 소스의 월물 정의. 일일 정산이 contract에 없는 월물을 새로 넣는다(월물 상장)
export type ContractDefinition = {
  symbol: string;
  // YYYY-MM
  contractMonth: string;
  firstTradeDate: string | null;
  lastTradeDate: string;
};

// tradeDate에 거래되는 월물인가(첫 거래일 ≤ tradeDate ≤ 최종 거래일). 첫 거래일을 모르면 최종 거래일만 본다
export function tradesOn(
  c: { firstTradeDate: string | null; lastTradeDate: string },
  tradeDate: string,
): boolean {
  return (
    c.lastTradeDate >= tradeDate && (c.firstTradeDate === null || c.firstTradeDate <= tradeDate)
  );
}

export type SourceBar = {
  contractSymbol: string;
  open: number | null;
  high: number | null;
  low: number | null;
  settle: number;
  volume: number;
};

export interface SettlementSource {
  readonly name: Source;
  // tradeDate에 거래되는 월물 정의
  listContracts(commodityCode: CommodityCode, tradeDate: string): Promise<ContractDefinition[]>;
  // tradeDate 확정 일봉. 소스에 아직 없는 월물은 빠진다
  fetchDailyBars(
    commodityCode: CommodityCode,
    symbols: readonly string[],
    tradeDate: string,
  ): Promise<SourceBar[]>;
  // 월물마다 from 이후(포함) 확정 일봉 전부. 주말 보충(D-110)이 월물당 한 번 부른다. 소스가 주는 범위 밖은 빠진다
  fetchRecentBars(
    commodityCode: CommodityCode,
    symbols: readonly string[],
    from: string,
  ): Promise<DatedSourceBar[]>;
}

export type DatedSourceBar = SourceBar & { tradeDate: string };

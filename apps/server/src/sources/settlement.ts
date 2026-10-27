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
}

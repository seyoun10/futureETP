// 장중 스냅숏 소스 인터페이스(D-094). 실소스는 Yahoo(yahooIntraday.ts)다.
// 심볼은 표준 심볼(D-049)이고, 소스별 표기 변환은 구현이 한다.
import type { Source } from '../constants.ts';

export type IntradayQuote = {
  contractSymbol: string;
  last: number;
  // 세션(17:00 CT~) 누적 값. 현재가만 받는 월물이거나 세션에 아직 거래가 없으면 null
  dayOpen: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  volume: number | null;
  // 소스가 준 마지막 체결 시각
  sourceTime: Date | null;
};

export interface IntradaySource {
  readonly name: Source;
  // 지수에 쓰는 월물: 현재가와 세션 시가·고가·저가·거래량. 소스에 없는 월물(만기 등)은 빠진다
  fetchSessionQuotes(symbols: readonly string[], sessionOpenAt: Date): Promise<IntradayQuote[]>;
  // 커브에만 쓰는 월물: 현재가만. 소스에 없는 월물은 빠진다
  fetchLastPrices(symbols: readonly string[]): Promise<IntradayQuote[]>;
}

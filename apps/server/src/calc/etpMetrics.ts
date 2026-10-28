// 상품별 순자산·평균 거래대금(D-015, D-017, data-model.md). ETN은 상장 중인 시리즈를 합산한다.
// 평균은 상품의 시리즈 값이 하나라도 있는 날만 센다(상장 전·값이 빠진 날은 뺀다).
import type { KnownEtpProduct } from './etpSeries.ts';

export type EtpMetrics = {
  productId: string;
  aum: number | null;
  // 원 단위로 반올림
  avgTradingValue: number | null;
};

function sumOf(tickers: readonly string[], values: ReadonlyMap<string, number>): number | null {
  let total: number | null = null;
  for (const ticker of tickers) {
    const value = values.get(ticker);
    if (value !== undefined) total = (total ?? 0) + value;
  }
  return total;
}

// aum: 기준일 종목별 순자산, dailyTradingValues: 거래일별 종목별 거래대금
export function etpProductMetrics(
  products: readonly KnownEtpProduct[],
  aum: ReadonlyMap<string, number>,
  dailyTradingValues: readonly ReadonlyMap<string, number>[],
): EtpMetrics[] {
  return products.map((product) => {
    const tickers = product.series
      .filter((series) => series.delistedDate === null)
      .map((series) => series.ticker);
    const daily = dailyTradingValues
      .map((values) => sumOf(tickers, values))
      .filter((value) => value !== null);
    return {
      productId: product.id,
      aum: sumOf(tickers, aum),
      avgTradingValue:
        daily.length === 0
          ? null
          : Math.round(daily.reduce((total, value) => total + value, 0) / daily.length),
    };
  });
}

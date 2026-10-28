import { describe, expect, it } from 'vitest';
import type { KnownEtpProduct } from './etpSeries.ts';
import { etpProductMetrics } from './etpMetrics.ts';

const product = (id: string, series: [string, string | null][]): KnownEtpProduct => ({
  id,
  groupingKey: null,
  isActive: true,
  series: series.map(([ticker, delistedDate]) => ({ ticker, delistedDate })),
});

describe('etpProductMetrics', () => {
  it('상장 중인 시리즈를 합산하고 폐지된 시리즈는 뺀다', () => {
    const products = [
      product('etn', [
        ['530031', null],
        ['530133', null],
        ['530000', '2026-01-02'],
      ]),
    ];
    const aum = new Map([
      ['530031', 100],
      ['530133', 50],
      ['530000', 999],
    ]);
    const days = [
      new Map([
        ['530031', 10],
        ['530133', 20],
      ]),
      new Map([
        ['530031', 30],
        ['530000', 999],
      ]),
    ];

    expect(etpProductMetrics(products, aum, days)).toEqual([
      { productId: 'etn', aum: 150, avgTradingValue: 30 },
    ]);
  });

  it('값이 없는 날은 평균에서 빼고 반올림한다. 값이 하나도 없으면 null', () => {
    const products = [product('new', [['261220', null]]), product('none', [['261221', null]])];
    const days = [new Map([['261220', 1]]), new Map(), new Map([['261220', 2]])];

    expect(etpProductMetrics(products, new Map(), days)).toEqual([
      { productId: 'new', aum: null, avgTradingValue: 2 },
      { productId: 'none', aum: null, avgTradingValue: null },
    ]);
  });

  it('거래가 없는 날(0)은 평균에 넣는다', () => {
    const days = [new Map([['261220', 0]]), new Map([['261220', 10]])];

    expect(etpProductMetrics([product('p', [['261220', null]])], new Map(), days)).toEqual([
      { productId: 'p', aum: null, avgTradingValue: 5 },
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  etnGroupingKey,
  planKrxEtpSeries,
  type KnownEtpProduct,
  type KrxEtpListing,
} from './etpSeries.ts';

// 삼성 2X WTI: 530031(무표기)·530133(B)가 실제로 겹치는 유일한 짝이다(research/etp-sources.md)
const SAMSUNG_2X_WTI = '삼성|CL|2|UNHEDGED';
const etn = (ticker: string, over: Partial<KrxEtpListing> = {}): KrxEtpListing => ({
  ticker,
  type: 'ETN',
  issuer: '삼성',
  commodityCode: 'CL',
  leverage: 2,
  fxHedge: 'UNHEDGED',
  ...over,
});
const etf = (ticker: string): KrxEtpListing => ({
  ticker,
  type: 'ETF',
  issuer: 'KODEX',
  commodityCode: 'CL',
  leverage: 1,
  fxHedge: 'HEDGED',
});
const product = (
  id: string,
  groupingKey: string | null,
  series: [string, string | null][],
  isActive = true,
): KnownEtpProduct => ({
  id,
  groupingKey,
  isActive,
  series: series.map(([ticker, delistedDate]) => ({ ticker, delistedDate })),
});

describe('etnGroupingKey', () => {
  it('발행사|원자재|배수|환헤지', () => {
    expect(etnGroupingKey(etn('530031'))).toBe(SAMSUNG_2X_WTI);
    expect(etnGroupingKey(etn('520076', { issuer: '미래에셋', leverage: -1.5 }))).toBe(
      '미래에셋|CL|-1.5|UNHEDGED',
    );
  });
});

describe('planKrxEtpSeries', () => {
  it('첫 수집: ETN은 같은 키끼리 한 상품으로 모으고, ETF는 종목마다 상품 하나', () => {
    const plan = planKrxEtpSeries(
      [],
      [etn('530031'), etf('261220'), etn('530133'), etn('570025', { fxHedge: 'HEDGED' })],
    );

    expect(plan.newProducts).toEqual([
      { groupingKey: SAMSUNG_2X_WTI, listings: [etn('530031'), etn('530133')] },
      { groupingKey: null, listings: [etf('261220')] },
      {
        groupingKey: '삼성|CL|2|HEDGED',
        listings: [etn('570025', { fxHedge: 'HEDGED' })],
      },
    ]);
    expect(plan.addSeries).toEqual([]);
  });

  it('이미 있는 종목만 오면 바꿀 것이 없다', () => {
    const plan = planKrxEtpSeries(
      [product('p1', SAMSUNG_2X_WTI, [['530031', null]]), product('p2', null, [['261220', null]])],
      [etn('530031'), etf('261220')],
    );

    expect(plan).toEqual({
      newProducts: [],
      addSeries: [],
      delistTickers: [],
      relistTickers: [],
      deactivateProductIds: [],
      reactivateProductIds: [],
    });
  });

  it('새 후속 시리즈는 키가 같은 기존 상품에 붙인다', () => {
    const plan = planKrxEtpSeries(
      [product('p1', SAMSUNG_2X_WTI, [['530031', null]])],
      [etn('530031'), etn('530133')],
    );

    expect(plan.addSeries).toEqual([{ productId: 'p1', listing: etn('530133') }]);
    expect(plan.newProducts).toEqual([]);
  });

  it('ETF는 속성이 같아도 묶지 않는다', () => {
    const plan = planKrxEtpSeries(
      [product('p2', null, [['261220', null]])],
      [etf('261220'), etf('530000')],
    );

    expect(plan.newProducts).toEqual([{ groupingKey: null, listings: [etf('530000')] }]);
  });

  it('목록에서 빠진 시리즈는 폐지하고, 남은 시리즈가 있으면 상품은 활성으로 둔다', () => {
    const plan = planKrxEtpSeries(
      [
        product('p1', SAMSUNG_2X_WTI, [
          ['530031', null],
          ['530133', null],
        ]),
      ],
      [etn('530133')],
    );

    expect(plan.delistTickers).toEqual(['530031']);
    expect(plan.deactivateProductIds).toEqual([]);
  });

  it('모든 시리즈가 폐지되면 상품을 비활성으로 두고, 이미 폐지된 시리즈는 다시 기록하지 않는다', () => {
    const plan = planKrxEtpSeries(
      [
        product('p1', SAMSUNG_2X_WTI, [
          ['530031', '2026-03-02'],
          ['530133', null],
        ]),
        product('p3', null, [['999999', '2025-01-02']], false),
      ],
      [],
    );

    expect(plan.delistTickers).toEqual(['530133']);
    expect(plan.deactivateProductIds).toEqual(['p1']);
  });

  it('비활성 상품의 키로 새 시리즈가 나오면 그 상품에 붙이고 다시 활성으로 둔다', () => {
    const plan = planKrxEtpSeries(
      [product('p1', SAMSUNG_2X_WTI, [['530031', '2026-03-02']], false)],
      [etn('530200')],
    );

    expect(plan.addSeries).toEqual([{ productId: 'p1', listing: etn('530200') }]);
    expect(plan.reactivateProductIds).toEqual(['p1']);
    expect(plan.relistTickers).toEqual([]);
  });

  it('같은 키의 상품이 여럿이면 활성 상품에 붙인다', () => {
    const plan = planKrxEtpSeries(
      [
        product('old', SAMSUNG_2X_WTI, [['530001', '2024-01-02']], false),
        product('p1', SAMSUNG_2X_WTI, [['530031', null]]),
      ],
      [etn('530031'), etn('530133')],
    );

    expect(plan.addSeries).toEqual([{ productId: 'p1', listing: etn('530133') }]);
    expect(plan.reactivateProductIds).toEqual([]);
  });

  it('폐지로 기록한 종목이 다시 나오면 폐지를 되돌리고 상품도 살린다', () => {
    const plan = planKrxEtpSeries(
      [product('p1', SAMSUNG_2X_WTI, [['530031', '2026-10-27']], false)],
      [etn('530031')],
    );

    expect(plan.relistTickers).toEqual(['530031']);
    expect(plan.reactivateProductIds).toEqual(['p1']);
    expect(plan.delistTickers).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import {
  indexAnchor,
  intradayCurveContracts,
  intradayIndex,
  type IndexAnchor,
  type SessionPrice,
} from './intraday.ts';

const contract = (symbol: string, lastTradeDate: string, isTarget = true) => ({
  symbol,
  contractMonth: `20${symbol.slice(3)}-01`,
  lastTradeDate,
  isTarget,
});

describe('intradayCurveContracts', () => {
  it('거래일에 만기 전인 대상 월물을 만기순 12개까지 고른다(최종 거래일 당일 포함)', () => {
    const later = Array.from({ length: 30 }, (_, i) =>
      contract(`CLX${30 + i}`, `${2030 + i}-10-20`),
    );
    const picked = intradayCurveContracts(
      [
        ...later,
        contract('CLZ26', '2026-11-17'),
        contract('CLX26', '2026-10-20'),
        contract('CLF27', '2026-12-16', false),
        contract('CLV26', '2026-09-22'),
      ],
      '2026-10-20',
    );
    expect(picked).toHaveLength(12);
    expect(picked.slice(0, 3).map((c) => c.symbol)).toEqual(['CLX26', 'CLZ26', 'CLX30']);
  });
});

describe('indexAnchor', () => {
  it('마지막 유효일을 기준으로 삼고, 유효 종가만 오래된 순으로 모은다', () => {
    expect(
      indexAnchor([
        { tradeDate: '2026-10-22', close: 40, blendedPrice: 80, isValid: true },
        { tradeDate: '2026-10-23', close: null, blendedPrice: -1, isValid: false },
        { tradeDate: '2026-10-26', close: 50, blendedPrice: 100, isValid: true },
        { tradeDate: '2026-10-27', close: null, blendedPrice: -2, isValid: false },
      ]),
    ).toEqual({ close: 50, blendedPrice: 100, prevCloses: [40, 50] });
    expect(indexAnchor([])).toBeNull();
  });
});

describe('intradayIndex', () => {
  // 맞춤 배율 50/100 = 0.5
  const anchor: IndexAnchor = {
    close: 50,
    blendedPrice: 100,
    prevCloses: Array<number>(49).fill(50),
  };
  const weights = [
    { symbol: 'CLZ26', weight: 0.6 },
    { symbol: 'CLF27', weight: 0.4 },
  ];
  const prices = new Map<string, SessionPrice>([
    ['CLZ26', { last: 110, dayOpen: 108, dayHigh: 112, dayLow: 105 }],
    // 세션 값이 없으면 현재가로 대신한다
    ['CLF27', { last: 100, dayOpen: null, dayHigh: null, dayLow: null }],
  ]);

  it('보유 비중으로 장중 가격을 직전 유효일에 이어 붙인다', () => {
    const index = intradayIndex(anchor, weights, prices);
    expect(index.last).toBeCloseTo(0.5 * (0.6 * 110 + 0.4 * 100));
    expect(index.open).toBeCloseTo(0.5 * (0.6 * 108 + 0.4 * 100));
    expect(index.high).toBeCloseTo(0.5 * (0.6 * 112 + 0.4 * 100));
    expect(index.low).toBeCloseTo(0.5 * (0.6 * 105 + 0.4 * 100));
  });

  it('이평선 4종 이격도: 직전 유효 종가 K−1개와 현재가·고가·저가, 종가가 모자라면 null', () => {
    const { disparityByMa } = intradayIndex(anchor, weights, prices);
    const ma20 = (19 * 50 + 53) / 20;
    expect(disparityByMa['20'].last).toBeCloseTo((53 / ma20 - 1) * 100);
    const ma20High = (19 * 50 + 53.6) / 20;
    expect(disparityByMa['20'].high).toBeCloseTo((53.6 / ma20High - 1) * 100);
    expect(disparityByMa['50'].low).toBeCloseTo((51.5 / ((49 * 50 + 51.5) / 50) - 1) * 100);
    expect(disparityByMa['100']).toEqual({ last: null, high: null, low: null });
    expect(disparityByMa['200']).toEqual({ last: null, high: null, low: null });
  });

  it('지수가 0 이하이면 그 값과 이격도는 null', () => {
    const negative = new Map(prices).set('CLF27', {
      last: -200,
      dayOpen: null,
      dayHigh: null,
      dayLow: null,
    });
    const index = intradayIndex(anchor, weights, negative);
    expect(index.last).toBeNull();
    expect(index.disparityByMa['20'].last).toBeNull();
  });

  it('보유 월물의 장중 값이 없으면 던진다', () => {
    expect(() =>
      intradayIndex(anchor, weights, new Map([['CLZ26', prices.get('CLZ26')!]])),
    ).toThrow('CLF27 장중 가격이 없다');
  });
});

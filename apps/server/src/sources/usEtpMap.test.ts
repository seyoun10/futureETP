import { describe, expect, it } from 'vitest';
import { classifyUsListings, US_ETP_EXCLUDED, US_ETP_MAP, US_ISSUER_URLS } from './usEtpMap.ts';

describe('US_ETP_MAP', () => {
  it('리서치 표의 17개 상품이고, 운용사마다 주소가 있으며 제외 목록과 겹치지 않는다', () => {
    const symbols = Object.keys(US_ETP_MAP);
    expect(symbols).toHaveLength(17);
    for (const symbol of symbols) {
      expect(US_ISSUER_URLS[US_ETP_MAP[symbol].issuer]).toMatch(/^https:\/\//);
      expect(US_ETP_EXCLUDED.has(symbol)).toBe(false);
    }
  });
});

describe('classifyUsListings', () => {
  it('매핑표 상품은 매핑과 함께, 원자재 이름의 새 상품은 후보로, 나머지는 버린다', () => {
    const result = classifyUsListings([
      { symbol: 'UCO', name: 'ProShares Ultra Bloomberg Crude Oil' },
      // 제외 목록
      { symbol: 'GLD', name: 'SPDR Gold Shares' },
      // 광산·에너지 주식
      { symbol: 'GDX', name: 'VanEck Gold Miners ETF' },
      { symbol: 'XOP', name: 'State Street SPDR S&P Oil & Gas Exploration & Production ETF' },
      { symbol: 'OIH', name: 'VanEck Oil Services ETF' },
      // 원자재 이름이 아님
      { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
      { symbol: 'BOIL2', name: 'Boiler Industries ETF' },
      // 새 후보
      { symbol: 'NEWG', name: 'Example 2X Gold Futures ETF' },
      { symbol: 'NEWW', name: 'Example WTI Strategy ETF' },
    ]);

    expect(result.mapped).toEqual([
      { symbol: 'UCO', name: 'ProShares Ultra Bloomberg Crude Oil', mapping: US_ETP_MAP.UCO },
    ]);
    expect(US_ETP_MAP.UCO).toMatchObject({
      commodityCode: 'CL',
      leverage: 2,
      rollRuleRef: 'BCBCLI',
    });
    expect(result.candidates.map((c) => c.symbol)).toEqual(['NEWG', 'NEWW']);
  });
});

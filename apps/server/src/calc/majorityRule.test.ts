import { describe, expect, it } from 'vitest';
import { krRuleId, majorityRules, MIN_MAJORITY_AUM, type MajorityProduct } from './majorityRule.ts';

const us = (ruleId: string | null, aum: number | null): MajorityProduct => ({
  commodityCode: 'GC',
  market: 'US',
  ruleId,
  aum,
});

describe('krRuleId', () => {
  it.each([
    ['S&P GSCI Gold Index(TR)', 'GSCI'],
    ['DJCI 2X Inverse Crude Oil TR', 'GSCI'],
    ['Bloomberg WTI Single 2X Leveraged TR', 'GSCI'],
    ['Bloomberg Natural Gas Single TR', 'GSCI'],
    ['Solactive Gold Total Return KRCD3M 2x Short Leverage', 'GSCI'],
    ['S&P GSCI Crude Oil Enhanced Index ER', 'GSCI_ENHANCED'],
    ['Bloomberg Gold Subindex', null],
    [null, null],
  ])('%s → %s', (index, ruleId) => {
    expect(krRuleId(index)).toBe(ruleId);
  });
});

describe('majorityRules', () => {
  it('하한 미만·순자산 모름·규칙 모름은 세지 않는다(D-015 미국 금)', () => {
    const [gc] = majorityRules([
      us('BCOM', 674_000_000),
      us('BCOM', 98_000_000),
      us('DBIQ_OY', 200_000_000),
      us('DBIQ_OY', 1_700_000),
      us('DBIQ_OY', null),
      us(null, 500_000_000),
    ]);

    expect(gc).toEqual({
      commodityCode: 'GC',
      market: 'US',
      ruleId: 'BCOM',
      counts: { BCOM: 2, DBIQ_OY: 1 },
    });
  });

  it('하한과 같으면 센다', () => {
    const [gc] = majorityRules([us('BCOM', MIN_MAJORITY_AUM.US), us('DBIQ_OY', 1)]);
    expect(gc.ruleId).toBe('BCOM');
  });

  it('동률이면 순자산 합계가 큰 규칙이다', () => {
    const [gc] = majorityRules([
      us('BCOM', 50_000_000),
      us('BCOM', 50_000_000),
      us('USO', 150_000_000),
      us('USO', 20_000_000),
    ]);
    expect(gc.ruleId).toBe('USO');
  });

  it('원자재·시장마다 따로 판정하고, 셀 상품이 없으면 null', () => {
    const results = majorityRules([
      { commodityCode: 'CL', market: 'KRX', ruleId: 'GSCI', aum: 2_000_000_000 },
      { commodityCode: 'CL', market: 'KRX', ruleId: 'GSCI_ENHANCED', aum: 9_000_000_000 },
      { commodityCode: 'CL', market: 'KRX', ruleId: 'GSCI', aum: 1_500_000_000 },
      { commodityCode: 'CL', market: 'US', ruleId: 'BCBCLI', aum: 5_000_000 },
    ]);

    expect(results).toEqual([
      {
        commodityCode: 'CL',
        market: 'KRX',
        ruleId: 'GSCI',
        counts: { GSCI: 2, GSCI_ENHANCED: 1 },
      },
      { commodityCode: 'CL', market: 'US', ruleId: null, counts: {} },
    ]);
  });
});

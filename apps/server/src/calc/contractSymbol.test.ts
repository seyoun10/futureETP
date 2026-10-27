import { describe, expect, it } from 'vitest';
import { parseContractSymbol, toContractSymbol } from './contractSymbol.ts';

describe('toContractSymbol', () => {
  it.each([
    ['CL', '2026-12', 'CLZ26'],
    ['GC', '2027-02', 'GCG27'],
    ['SI', '2010-07', 'SIN10'],
    ['NG', '2031-01', 'NGF31'],
  ] as const)('%s %s → %s', (code, month, symbol) => {
    expect(toContractSymbol(code, month)).toBe(symbol);
  });

  it.each(['2026-13', '2026-1', '1999-12', '26-12'])('잘못된 월물 %s는 실패한다', (month) => {
    expect(() => toContractSymbol('CL', month)).toThrow(/Invalid contract month/);
  });
});

describe('parseContractSymbol', () => {
  it('표준 심볼을 원자재와 월물로 나눈다', () => {
    expect(parseContractSymbol('GCV26')).toEqual({ commodityCode: 'GC', contractMonth: '2026-10' });
  });

  it('모든 월 코드가 왕복 변환된다', () => {
    for (let m = 1; m <= 12; m++) {
      const month = `2027-${String(m).padStart(2, '0')}`;
      expect(parseContractSymbol(toContractSymbol('NG', month)).contractMonth).toBe(month);
    }
  });

  it.each(['CLZ6', 'CLZ26.NYM', 'HGZ26', 'CLA26', 'clz26'])('표준형이 아닌 %s는 실패한다', (s) => {
    expect(() => parseContractSymbol(s)).toThrow(/Invalid contract symbol/);
  });
});

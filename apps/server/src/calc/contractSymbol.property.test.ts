// 속성 기반 테스트(D-129): 월물 표준 심볼(D-049) 변환이 서로의 역함수인지 본다.
import { COMMODITY_CODES } from '@futureetp/shared';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContractSymbol, toContractSymbol } from './contractSymbol.ts';

const commodity = fc.constantFrom(...COMMODITY_CODES);
const contractMonth = fc
  .record({ year: fc.integer({ min: 2000, max: 2099 }), month: fc.integer({ min: 1, max: 12 }) })
  .map(({ year, month }) => `${year}-${String(month).padStart(2, '0')}`);

describe('월물 심볼 속성', () => {
  it('toContractSymbol → parseContractSymbol 왕복', () => {
    fc.assert(
      fc.property(commodity, contractMonth, (code, month) => {
        expect(parseContractSymbol(toContractSymbol(code, month))).toEqual({
          commodityCode: code,
          contractMonth: month,
        });
      }),
    );
  });
});

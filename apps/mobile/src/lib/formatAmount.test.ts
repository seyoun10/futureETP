import { compactAmount } from './formatAmount';

describe('compactAmount', () => {
  it('억·만은 정수로 줄인다', () => {
    expect(compactAmount(1_555_015_000_000, 'eok')).toBe('15,550억');
    expect(compactAmount(1_198_418_445, 'eok')).toBe('12억');
    expect(compactAmount(45_000_000, 'eok')).toBe('4,500만');
    expect(compactAmount(9_999, 'eok')).toBe('9,999');
  });

  it('T·B·M·K는 소수 한 자리로 줄인다', () => {
    expect(compactAmount(12_345_678, 'si')).toBe('12.3M');
    expect(compactAmount(1_555_015_000_000, 'si')).toBe('1.6T');
    expect(compactAmount(850, 'si')).toBe('850');
  });

  it('반올림해 위 단위에 닿으면 위 단위로 쓴다', () => {
    expect(compactAmount(99_999_999, 'eok')).toBe('1억');
    expect(compactAmount(999_960, 'si')).toBe('1.0M');
    expect(compactAmount(999_940, 'si')).toBe('999.9K');
  });
});

import {
  formatChange,
  formatChangePct,
  formatContractMonth,
  formatContractMonthShort,
  formatPrice,
} from './formatNumber';

describe('formatPrice', () => {
  it('천 단위 쉼표와 소수 자릿수를 맞춘다', () => {
    expect(formatPrice(2405.1, 1)).toBe('2,405.1');
    expect(formatPrice(1234567.891, 2)).toBe('1,234,567.89');
    expect(formatPrice(2.7656, 3)).toBe('2.766');
    expect(formatPrice(80, 2)).toBe('80.00');
    expect(formatPrice(999, 0)).toBe('999');
  });

  it('음수는 앞에 -를 붙이고, 반올림해 0이면 붙이지 않는다', () => {
    expect(formatPrice(-1234.5, 1)).toBe('-1,234.5');
    expect(formatPrice(-0.001, 2)).toBe('0.00');
  });
});

describe('formatChange', () => {
  it('상승은 +, 하락은 -를 붙인다', () => {
    expect(formatChange(12.15, 1)).toBe('+12.2');
    expect(formatChange(-0.029, 3)).toBe('-0.029');
    expect(formatChange(-1250, 1)).toBe('-1,250.0');
  });

  it('0이거나 반올림해 0이면 부호가 없다', () => {
    expect(formatChange(0, 2)).toBe('0.00');
    expect(formatChange(0.004, 2)).toBe('0.00');
  });
});

describe('formatChangePct', () => {
  it('소수 둘째 자리 등락률', () => {
    expect(formatChangePct(0.5075)).toBe('+0.51%');
    expect(formatChangePct(-1.04)).toBe('-1.04%');
  });
});

describe('formatContractMonth', () => {
  it('YYYY-MM을 CME 표기 월물로 쓴다', () => {
    expect(formatContractMonth('2026-12')).toBe('DEC26');
    expect(formatContractMonth('2027-01')).toBe('JAN27');
  });
});

describe('formatContractMonthShort', () => {
  it('YYYY-MM을 연도 두 자리 + 월 두 자리 숫자로 쓴다', () => {
    expect(formatContractMonthShort('2026-12')).toBe('2612');
    expect(formatContractMonthShort('2027-02')).toBe('2702');
  });
});

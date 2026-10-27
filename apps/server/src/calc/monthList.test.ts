import { describe, expect, it } from 'vitest';
import {
  MONTH_LIST_SIZE,
  isTargetMonth,
  selectMonthList,
  type ActiveMonthRule,
  type ListedContract,
} from './monthList.ts';
import { toContractSymbol } from './contractSymbol.ts';

const GC_RULES: ActiveMonthRule[] = [
  { validFrom: '2010-01-01', validTo: null, months: [2, 4, 6, 8, 10, 12] },
];

const contract = (
  contractMonth: string,
  lastTradeDate: string,
  isTarget = true,
): ListedContract => ({
  symbol: toContractSymbol('GC', contractMonth),
  contractMonth,
  lastTradeDate,
  isTarget,
});

// 2026-10 ~ 2027-07 금 월물. 최종 거래일은 인도월 끝에서 3번째 영업일(research/cme-calendar.md)
const GC_CONTRACTS: ListedContract[] = [
  contract('2026-10', '2026-10-28'),
  contract('2026-11', '2026-11-25', false),
  contract('2026-12', '2026-12-29'),
  contract('2027-01', '2027-01-27', false),
  contract('2027-02', '2027-02-24'),
  contract('2027-03', '2027-03-29', false),
  contract('2027-04', '2027-04-28'),
  contract('2027-05', '2027-05-26', false),
  contract('2027-06', '2027-06-28'),
  contract('2027-07', '2027-07-28', false),
];

const symbols = (list: readonly ListedContract[]) => list.map((c) => c.symbol);

describe('isTargetMonth', () => {
  it('활성 월물 규칙이 없으면(에너지) 모든 월물이 대상이다', () => {
    for (let m = 1; m <= 12; m++) {
      expect(isTargetMonth(`2027-${String(m).padStart(2, '0')}`, [])).toBe(true);
    }
  });

  it('금속은 활성 월물만 대상이다', () => {
    expect(isTargetMonth('2026-12', GC_RULES)).toBe(true);
    expect(isTargetMonth('2026-11', GC_RULES)).toBe(false);
  });

  it('월물의 첫날이 들어가는 기간의 규칙을 쓴다', () => {
    const rules: ActiveMonthRule[] = [
      { validFrom: '2010-01-01', validTo: '2027-12-31', months: [3, 5, 7, 9, 12] },
      { validFrom: '2028-01-01', validTo: null, months: [1, 3, 5, 7, 9, 12] },
    ];
    expect(isTargetMonth('2027-01', rules)).toBe(false);
    expect(isTargetMonth('2027-12', rules)).toBe(true);
    expect(isTargetMonth('2028-01', rules)).toBe(true);
  });

  it('규칙이 있는데 해당 기간이 없으면 대상이 아니다', () => {
    expect(isTargetMonth('2009-12', GC_RULES)).toBe(false);
  });
});

describe('selectMonthList', () => {
  it('상수', () => {
    expect(MONTH_LIST_SIZE).toBe(5);
  });

  it('비활성 월물을 건너뛰고 만기순 5개를 고른다(product.md 예: 2026-10-22 금)', () => {
    const list = selectMonthList(GC_CONTRACTS, '2026-10-22', 'GCZ26');
    expect(symbols(list)).toEqual(['GCV26', 'GCZ26', 'GCG27', 'GCJ27', 'GCM27']);
  });

  it('입력 순서와 관계없이 만기순이다', () => {
    const list = selectMonthList([...GC_CONTRACTS].reverse(), '2026-10-22', 'GCZ26');
    expect(symbols(list)).toEqual(['GCV26', 'GCZ26', 'GCG27', 'GCJ27', 'GCM27']);
  });

  it('최종 거래일 당일에는 남고 다음 거래일에 빠진다', () => {
    expect(symbols(selectMonthList(GC_CONTRACTS, '2026-10-28', 'GCZ26'))[0]).toBe('GCV26');
    expect(symbols(selectMonthList(GC_CONTRACTS, '2026-10-29', 'GCZ26'))[0]).toBe('GCZ26');
  });

  it('대표월물이 5개 안에 없으면 6번째로 덧붙인다', () => {
    const later = [...GC_CONTRACTS, contract('2027-08', '2027-08-27')];
    const list = selectMonthList(later, '2026-10-22', 'GCQ27');
    expect(symbols(list)).toEqual(['GCV26', 'GCZ26', 'GCG27', 'GCJ27', 'GCM27', 'GCQ27']);
  });

  it('대표월물이 없거나 목록에 없는 심볼이면 5개만 돌려준다', () => {
    expect(selectMonthList(GC_CONTRACTS, '2026-10-22', null)).toHaveLength(5);
    expect(selectMonthList(GC_CONTRACTS, '2026-10-22', 'GCQ27')).toHaveLength(5);
  });

  it('대표월물이 비대상이거나 만기됐어도 덧붙인다(안전장치가 아직 옮기지 않은 경우)', () => {
    const list = selectMonthList(GC_CONTRACTS, '2026-10-29', 'GCV26');
    expect(symbols(list)).toEqual(['GCZ26', 'GCG27', 'GCJ27', 'GCM27', 'GCV26']);
  });

  it('남은 대상 월물이 5개보다 적으면 있는 만큼만 돌려준다', () => {
    expect(symbols(selectMonthList(GC_CONTRACTS, '2027-03-01', 'GCJ27'))).toEqual([
      'GCJ27',
      'GCM27',
    ]);
  });

  it('에너지는 연속된 월물 5개다', () => {
    const cl = ['2026-12', '2027-01', '2027-02', '2027-03', '2027-04', '2027-05'].map(
      (m, i): ListedContract => ({
        symbol: toContractSymbol('CL', m),
        contractMonth: m,
        lastTradeDate: `2026-${String(11 + Math.floor(i / 2)).padStart(2, '0')}-${10 + i}`,
        isTarget: true,
      }),
    );
    expect(symbols(selectMonthList(cl, '2026-10-22', 'CLZ26'))).toEqual([
      'CLZ26',
      'CLF27',
      'CLG27',
      'CLH27',
      'CLJ27',
    ]);
  });
});

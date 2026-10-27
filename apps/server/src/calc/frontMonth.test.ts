// 명세(product.md "계산 정의 > 기준값 > 대표월물", D-004)만 보고 작성한 테스트(D-057).
import { describe, expect, it } from 'vitest';
import {
  buildFrontSeries,
  initialFrontSymbol,
  nextFrontSymbol,
  type DayVolumes,
  type FrontDay,
} from './frontMonth.ts';
import type { ListedContract } from './monthList.ts';
import { toContractSymbol } from './contractSymbol.ts';

const cl = (contractMonth: string, lastTradeDate: string): ListedContract => ({
  symbol: toContractSymbol('CL', contractMonth),
  contractMonth,
  lastTradeDate,
  isTarget: true,
});

const gc = (contractMonth: string, lastTradeDate: string, isTarget = true): ListedContract => ({
  symbol: toContractSymbol('GC', contractMonth),
  contractMonth,
  lastTradeDate,
  isTarget,
});

// WTI: 모든 월물이 대상. 최종 거래일은 인도월 전월 25일 직전 3번째 영업일 무렵
const CL_CONTRACTS: ListedContract[] = [
  cl('2026-11', '2026-10-20'),
  cl('2026-12', '2026-11-19'),
  cl('2027-01', '2026-12-17'),
  cl('2027-02', '2027-01-20'),
  cl('2027-03', '2027-02-22'),
];

// 금: 활성 월물(2·4·6·8·10·12)만 대상
const GC_CONTRACTS: ListedContract[] = [
  gc('2026-10', '2026-10-28'),
  gc('2026-11', '2026-11-25', false),
  gc('2026-12', '2026-12-29'),
  gc('2027-01', '2027-01-27', false),
  gc('2027-02', '2027-02-24'),
  gc('2027-03', '2027-03-29', false),
  gc('2027-04', '2027-04-28'),
];

const vols = (entries: Record<string, number>): DayVolumes => new Map(Object.entries(entries));

describe('nextFrontSymbol', () => {
  const day = '2026-10-27';

  it('만기가 늦은 월물의 전일 거래량이 현재 월물을 넘으면 옮긴다', () => {
    expect(nextFrontSymbol(CL_CONTRACTS, day, vols({ CLZ26: 100, CLF27: 150 }), 'CLZ26')).toBe(
      'CLF27',
    );
  });

  it('거래량이 현재 월물과 같으면 유지한다', () => {
    expect(nextFrontSymbol(CL_CONTRACTS, day, vols({ CLZ26: 100, CLF27: 100 }), 'CLZ26')).toBe(
      'CLZ26',
    );
  });

  it('거래량이 현재 월물보다 적으면 유지한다', () => {
    expect(
      nextFrontSymbol(CL_CONTRACTS, day, vols({ CLZ26: 300, CLF27: 200, CLG27: 50 }), 'CLZ26'),
    ).toBe('CLZ26');
  });

  it('넘는 후보가 여럿이면 거래량이 가장 많은 월물로 건너뛴다', () => {
    expect(
      nextFrontSymbol(
        CL_CONTRACTS,
        day,
        vols({ CLZ26: 100, CLF27: 150, CLG27: 200, CLH27: 120 }),
        'CLZ26',
      ),
    ).toBe('CLG27');
  });

  it('이전(만기가 이른) 월물의 거래량이 커도 되돌아가지 않는다', () => {
    expect(
      nextFrontSymbol(CL_CONTRACTS, day, vols({ CLZ26: 500, CLF27: 100, CLG27: 50 }), 'CLF27'),
    ).toBe('CLF27');
  });

  it('입력 순서와 관계없다', () => {
    const reversed = [...CL_CONTRACTS].reverse();
    expect(
      nextFrontSymbol(reversed, day, vols({ CLZ26: 100, CLF27: 150, CLG27: 200 }), 'CLZ26'),
    ).toBe('CLG27');
    expect(nextFrontSymbol(reversed, day, vols({ CLZ26: 500, CLF27: 100 }), 'CLF27')).toBe('CLF27');
  });

  it('금속은 비활성 월물의 거래량이 커도 후보가 아니다', () => {
    expect(
      nextFrontSymbol(GC_CONTRACTS, day, vols({ GCZ26: 100, GCF27: 999, GCG27: 50 }), 'GCZ26'),
    ).toBe('GCZ26');
    expect(
      nextFrontSymbol(GC_CONTRACTS, day, vols({ GCZ26: 100, GCF27: 999, GCG27: 150 }), 'GCZ26'),
    ).toBe('GCG27');
  });

  it('거래량 맵에 없는 월물은 0으로 본다', () => {
    // 현재 월물 누락 = 0 → 거래량이 1이라도 있는 후보로 옮긴다
    expect(nextFrontSymbol(CL_CONTRACTS, day, vols({ CLF27: 1 }), 'CLZ26')).toBe('CLF27');
    // 모두 누락이면 넘는 후보가 없어 유지
    expect(nextFrontSymbol(CL_CONTRACTS, day, vols({}), 'CLZ26')).toBe('CLZ26');
  });

  it('후보끼리 거래량이 같으면 만기가 가까운 월물을 고른다', () => {
    expect(
      nextFrontSymbol(CL_CONTRACTS, day, vols({ CLZ26: 100, CLF27: 200, CLG27: 200 }), 'CLZ26'),
    ).toBe('CLF27');
  });

  it('현재 월물이 contracts에 없으면 throw', () => {
    expect(() => nextFrontSymbol(CL_CONTRACTS, day, vols({}), 'CLZ29')).toThrow();
  });

  describe('안전장치: 현재 월물이 최종 거래일에 도달', () => {
    it('넘는 후보가 없어도 만기순 다음 대상 월물로 옮긴다', () => {
      expect(
        nextFrontSymbol(
          CL_CONTRACTS,
          '2026-11-19',
          vols({ CLZ26: 1000, CLF27: 10, CLG27: 5 }),
          'CLZ26',
        ),
      ).toBe('CLF27');
    });

    it('규칙으로 고른 월물이 있으면 그 월물이 우선이다', () => {
      expect(
        nextFrontSymbol(
          CL_CONTRACTS,
          '2026-11-19',
          vols({ CLZ26: 1000, CLF27: 10, CLG27: 2000 }),
          'CLZ26',
        ),
      ).toBe('CLG27');
    });

    it('금속은 만기순 다음 "대상" 월물로 옮긴다(비활성 월물 건너뜀)', () => {
      expect(
        nextFrontSymbol(
          GC_CONTRACTS,
          '2026-10-28',
          vols({ GCV26: 1000, GCX26: 5000, GCZ26: 10 }),
          'GCV26',
        ),
      ).toBe('GCZ26');
    });

    it('최종 거래일이 이미 지났어도 옮긴다', () => {
      expect(nextFrontSymbol(CL_CONTRACTS, '2026-11-20', vols({ CLZ26: 1000 }), 'CLZ26')).toBe(
        'CLF27',
      );
    });

    it('다음 거래일에 거래되지 않는 월물(그날 만기)로는 옮기지 않는다', () => {
      // CLF27 최종 거래일 = 2026-12-17 → 다음 거래일엔 없으므로 CLG27
      expect(
        nextFrontSymbol(CL_CONTRACTS, '2026-12-17', vols({ CLZ26: 0, CLF27: 999 }), 'CLZ26'),
      ).toBe('CLG27');
    });

    it('옮길 월물이 없으면 null', () => {
      expect(
        nextFrontSymbol([cl('2026-12', '2026-11-19')], '2026-11-19', vols({ CLZ26: 10 }), 'CLZ26'),
      ).toBeNull();
      // 남은 월물이 모두 비활성이어도 null
      const gcTail = [gc('2026-10', '2026-10-28'), gc('2026-11', '2026-11-25', false)];
      expect(nextFrontSymbol(gcTail, '2026-10-28', vols({ GCX26: 100 }), 'GCV26')).toBeNull();
    });
  });
});

describe('initialFrontSymbol', () => {
  it('대상 월물 중 그날 거래량이 가장 많은 월물', () => {
    expect(
      initialFrontSymbol(CL_CONTRACTS, '2026-10-27', vols({ CLZ26: 300, CLF27: 200, CLG27: 400 })),
    ).toBe('CLG27');
  });

  it('비활성 월물은 거래량이 커도 고르지 않는다', () => {
    expect(
      initialFrontSymbol(GC_CONTRACTS, '2026-10-27', vols({ GCX26: 999, GCZ26: 300, GCV26: 10 })),
    ).toBe('GCZ26');
  });

  it('이미 만기된 월물은 제외하고, 그날이 최종 거래일인 월물은 포함한다', () => {
    // CLX26 최종 거래일 2026-10-20 < 2026-10-27
    expect(initialFrontSymbol(CL_CONTRACTS, '2026-10-27', vols({ CLX26: 999, CLZ26: 1 }))).toBe(
      'CLZ26',
    );
    // GCV26 최종 거래일 = 그날
    expect(initialFrontSymbol(GC_CONTRACTS, '2026-10-28', vols({ GCV26: 500, GCZ26: 100 }))).toBe(
      'GCV26',
    );
  });

  it('거래량이 같으면 만기가 가까운 월물, 맵에 없으면 0', () => {
    expect(initialFrontSymbol(CL_CONTRACTS, '2026-10-27', vols({ CLF27: 200, CLG27: 200 }))).toBe(
      'CLF27',
    );
    expect(initialFrontSymbol(CL_CONTRACTS, '2026-10-27', vols({}))).toBe('CLZ26');
  });

  it('후보가 없으면 null', () => {
    expect(initialFrontSymbol(CL_CONTRACTS, '2027-03-01', vols({ CLH27: 100 }))).toBeNull();
    expect(initialFrontSymbol([], '2026-10-27', vols({}))).toBeNull();
  });
});

describe('buildFrontSeries', () => {
  const series = (contracts: readonly ListedContract[], days: FrontDay[]) =>
    buildFrontSeries(contracts, days).map((d) => [d.tradeDate, d.symbol]);

  it('빈 입력이면 빈 배열', () => {
    expect(buildFrontSeries(CL_CONTRACTS, [])).toEqual([]);
  });

  it('거래량 역전은 다음 거래일부터 적용한다', () => {
    const days: FrontDay[] = [
      { tradeDate: '2026-10-26', volumes: vols({ CLZ26: 200, CLF27: 100 }) },
      { tradeDate: '2026-10-27', volumes: vols({ CLZ26: 100, CLF27: 200 }) },
      { tradeDate: '2026-10-28', volumes: vols({ CLZ26: 90, CLF27: 210 }) },
    ];
    expect(series(CL_CONTRACTS, days)).toEqual([
      ['2026-10-26', 'CLZ26'],
      ['2026-10-27', 'CLZ26'],
      ['2026-10-28', 'CLF27'],
    ]);
  });

  it('첫날은 그날 거래량으로 고른다', () => {
    const days: FrontDay[] = [
      { tradeDate: '2026-10-26', volumes: vols({ CLZ26: 100, CLF27: 200 }) },
    ];
    expect(series(CL_CONTRACTS, days)).toEqual([['2026-10-26', 'CLF27']]);
  });

  it('거래량이 엎치락뒤치락해도 한 번 옮긴 뒤 되돌아가지 않는다', () => {
    const days: FrontDay[] = [
      { tradeDate: '2026-11-02', volumes: vols({ CLZ26: 200, CLF27: 100 }) },
      { tradeDate: '2026-11-03', volumes: vols({ CLZ26: 100, CLF27: 200 }) },
      { tradeDate: '2026-11-04', volumes: vols({ CLZ26: 300, CLF27: 100 }) },
      { tradeDate: '2026-11-05', volumes: vols({ CLZ26: 100, CLF27: 300 }) },
      { tradeDate: '2026-11-06', volumes: vols({ CLZ26: 400, CLF27: 100 }) },
    ];
    expect(series(CL_CONTRACTS, days)).toEqual([
      ['2026-11-02', 'CLZ26'],
      ['2026-11-03', 'CLZ26'],
      ['2026-11-04', 'CLF27'],
      ['2026-11-05', 'CLF27'],
      ['2026-11-06', 'CLF27'],
    ]);
  });

  it('최종 거래일 다음 거래일에는 거래량과 관계없이 옮긴다', () => {
    const days: FrontDay[] = [
      { tradeDate: '2026-10-27', volumes: vols({ GCV26: 900, GCZ26: 100 }) },
      { tradeDate: '2026-10-28', volumes: vols({ GCV26: 900, GCX26: 5000, GCZ26: 100 }) },
      { tradeDate: '2026-10-29', volumes: vols({ GCZ26: 100, GCG27: 50 }) },
    ];
    expect(series(GC_CONTRACTS, days)).toEqual([
      ['2026-10-27', 'GCV26'],
      ['2026-10-28', 'GCV26'],
      ['2026-10-29', 'GCZ26'],
    ]);
  });

  it('직전 결과가 null이면 그날 거래량으로 다시 고른다', () => {
    const only = [cl('2026-12', '2026-11-19')];
    const days: FrontDay[] = [
      { tradeDate: '2026-11-19', volumes: vols({ CLZ26: 100 }) },
      { tradeDate: '2026-11-20', volumes: vols({ CLZ26: 100 }) },
      { tradeDate: '2026-11-23', volumes: vols({}) },
    ];
    // 11-20: 안전장치에서 옮길 월물 없음 → null, 11-23: 다시 initialFrontSymbol → 후보 없음 → null
    expect(series(only, days)).toEqual([
      ['2026-11-19', 'CLZ26'],
      ['2026-11-20', null],
      ['2026-11-23', null],
    ]);
  });

  it('첫날 결과가 null이면 다음 날도 그날 거래량으로 고른다', () => {
    // 첫날 대상 월물이 모두 비활성 → null. 결과가 null인 날 다음에도 throw 없이 진행한다
    const gcTail = [gc('2026-10', '2026-10-28'), gc('2026-11', '2026-11-25', false)];
    const days: FrontDay[] = [
      { tradeDate: '2026-10-29', volumes: vols({ GCX26: 100 }) },
      { tradeDate: '2026-10-30', volumes: vols({ GCX26: 100 }) },
    ];
    expect(series(gcTail, days)).toEqual([
      ['2026-10-29', null],
      ['2026-10-30', null],
    ]);
  });
});

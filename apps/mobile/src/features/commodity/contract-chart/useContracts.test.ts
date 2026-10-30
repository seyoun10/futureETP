import type { ContractsChart } from '@futureetp/shared';
import { mergeContractPages } from './useContracts';

const page = (
  dates: string[],
  contracts: ContractsChart['contracts'],
  hasMore: boolean,
): ContractsChart => ({
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: null,
  },
  priceDecimals: 3,
  dates,
  hasMore,
  provisional: false,
  contracts,
});

describe('mergeContractPages', () => {
  it('이전 페이지 날짜·가격을 앞에 붙이고, 이전 페이지에 없는 월물은 null로 채운다', () => {
    const latest = page(
      ['d3', 'd4'],
      [
        { symbol: 'NGZ26', contractMonth: '2026-12', prices: [3, 4] },
        { symbol: 'NGF27', contractMonth: '2027-01', prices: [null, 5] },
      ],
      true,
    );
    const older = page(
      ['d1', 'd2'],
      [{ symbol: 'NGZ26', contractMonth: '2026-12', prices: [1, 2] }],
      false,
    );
    const merged = mergeContractPages({ pages: [latest, older], pageParams: [undefined, 'd3'] });

    expect(merged.dates).toEqual(['d1', 'd2', 'd3', 'd4']);
    expect(merged.contracts.map((c) => c.prices)).toEqual([
      [1, 2, 3, 4],
      [null, null, null, 5],
    ]);
    expect(merged.hasMore).toBe(false);
  });

  it('한 페이지면 그대로 돌려준다', () => {
    const only = page(['d1'], [], false);
    expect(mergeContractPages({ pages: [only], pageParams: [undefined] })).toBe(only);
  });
});

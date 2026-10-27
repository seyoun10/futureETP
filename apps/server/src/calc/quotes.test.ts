import { describe, expect, it } from 'vitest';
import { buildQuotes } from './quotes.ts';
import type { QuoteBar, QuoteInput } from './quotes.ts';

const at = (iso: string) => new Date(iso);
const contract = (symbol: string, contractMonth: string) => ({
  symbol,
  contractMonth,
  lastTradeDate: `${contractMonth}-20`,
  isTarget: true,
});
const bar = (contractSymbol: string, tradeDate: string, settle: number, collected: string) => ({
  contractSymbol,
  tradeDate,
  settle,
  collectedAt: at(collected),
  revisedAt: null,
});

const input = (overrides: Partial<QuoteInput>): QuoteInput => ({
  contracts: [contract('CLZ26', '2026-12')],
  frontSymbol: 'CLZ26',
  tradeDate: '2026-10-22',
  prevTradeDate: '2026-10-21',
  bars: [bar('CLZ26', '2026-10-21', 80, '2026-10-21T23:31:00Z')],
  snapshots: [],
  ...overrides,
});

describe('buildQuotes', () => {
  it('그 거래일 정산가가 있으면 정산가와 직전 정산가 대비를 쓴다', () => {
    const settled = bar('CLZ26', '2026-10-22', 82, '2026-10-22T23:31:00Z');
    const result = buildQuotes(
      input({
        bars: [bar('CLZ26', '2026-10-21', 80, '2026-10-21T23:31:00Z'), settled],
        snapshots: [{ contractSymbol: 'CLZ26', capturedAt: at('2026-10-22T21:00:00Z'), last: 81 }],
      }),
    );
    expect(result.quotes).toEqual([
      {
        symbol: 'CLZ26',
        contractMonth: '2026-12',
        price: 82,
        change: 2,
        changePct: 2.5,
        noTrade: false,
        isFront: true,
      },
    ]);
    expect(result).toMatchObject({ asOf: at('2026-10-22T23:31:00Z'), delayed: false });
  });

  it('정산 정정 시각이 있으면 그 시각을 쓴다', () => {
    const revised: QuoteBar = {
      ...bar('CLZ26', '2026-10-22', 82, '2026-10-22T23:31:00Z'),
      revisedAt: at('2026-10-23T14:00:00Z'),
    };
    const result = buildQuotes(input({ bars: [revised] }));
    expect(result.asOf).toEqual(at('2026-10-23T14:00:00Z'));
    // 직전 정산가가 없으면 대비는 비운다
    expect(result.quotes[0]).toMatchObject({ price: 82, change: null, changePct: null });
  });

  it('정산 전이면 최근 스냅숏을 쓰고 지연으로 표시한다', () => {
    const result = buildQuotes(
      input({
        snapshots: [{ contractSymbol: 'CLZ26', capturedAt: at('2026-10-22T15:00:00Z'), last: 79 }],
      }),
    );
    expect(result.quotes[0]).toMatchObject({ price: 79, change: -1, noTrade: false });
    expect(result).toMatchObject({ asOf: at('2026-10-22T15:00:00Z'), delayed: true });
  });

  it('정산가·스냅숏이 모두 없으면 직전 정산가를 거래 없음으로, 그것도 없으면 빈 값을 둔다', () => {
    const result = buildQuotes(
      input({
        contracts: [contract('CLZ26', '2026-12'), contract('CLF27', '2027-01')],
        frontSymbol: 'CLF27',
      }),
    );
    expect(result.quotes).toEqual([
      {
        symbol: 'CLZ26',
        contractMonth: '2026-12',
        price: 80,
        change: null,
        changePct: null,
        noTrade: true,
        isFront: false,
      },
      {
        symbol: 'CLF27',
        contractMonth: '2027-01',
        price: null,
        change: null,
        changePct: null,
        noTrade: true,
        isFront: true,
      },
    ]);
    expect(result).toMatchObject({ asOf: at('2026-10-21T23:31:00Z'), delayed: false });
  });

  it('값이 하나도 없으면 asOf는 null이다', () => {
    expect(buildQuotes(input({ bars: [] })).asOf).toBeNull();
  });
});

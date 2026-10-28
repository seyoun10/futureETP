// 명세(product.md 월물차트, screens.md C-c, D-048)만 보고 작성한 테스트(D-057).
import { describe, expect, it } from 'vitest';
import { buildContractLines } from './contractLines.ts';
import type { QuoteBar } from './quotes.ts';

const at = (iso: string) => new Date(iso);
const CONTRACTS = [
  { symbol: 'CLZ26', contractMonth: '2026-12', lastTradeDate: '2026-11-20', isTarget: true },
  { symbol: 'CLF27', contractMonth: '2027-01', lastTradeDate: '2026-12-18', isTarget: true },
];
const bar = (contractSymbol: string, tradeDate: string, settle: number): QuoteBar => ({
  contractSymbol,
  tradeDate,
  settle,
  collectedAt: at(`${tradeDate}T23:40:00Z`),
  revisedAt: null,
});

describe('buildContractLines', () => {
  it('날짜를 합치고 상장 전은 null로 채운다', () => {
    const result = buildContractLines({
      contracts: CONTRACTS,
      tradeDate: '2026-10-22',
      bars: [
        bar('CLZ26', '2026-10-20', 70),
        bar('CLZ26', '2026-10-21', 71),
        bar('CLF27', '2026-10-21', 72),
      ],
      snapshots: [],
    });
    expect(result.dates).toEqual(['2026-10-20', '2026-10-21']);
    expect(result.lines).toEqual([
      { symbol: 'CLZ26', contractMonth: '2026-12', prices: [70, 71] },
      { symbol: 'CLF27', contractMonth: '2027-01', prices: [null, 72] },
    ]);
    expect(result.provisional).toBe(false);
    expect(result.asOf).toEqual(at('2026-10-21T23:40:00Z'));
  });

  it('그날 정산가가 없는 월물만 스냅숏으로 오늘 값을 붙인다', () => {
    const result = buildContractLines({
      contracts: CONTRACTS,
      tradeDate: '2026-10-22',
      bars: [
        bar('CLZ26', '2026-10-21', 71),
        bar('CLF27', '2026-10-21', 72),
        bar('CLZ26', '2026-10-22', 73),
      ],
      snapshots: [
        { contractSymbol: 'CLZ26', capturedAt: at('2026-10-22T20:00:00Z'), last: 99 },
        { contractSymbol: 'CLF27', capturedAt: at('2026-10-22T20:05:00Z'), last: 74 },
      ],
    });
    expect(result.dates).toEqual(['2026-10-21', '2026-10-22']);
    expect(result.lines.map((l) => l.prices)).toEqual([
      [71, 73],
      [72, 74],
    ]);
    expect(result.provisional).toBe(true);
    expect(result.asOf).toEqual(at('2026-10-22T23:40:00Z'));
  });

  it('정정 시각을 수집 시각보다 먼저 쓰고, 목록 밖 월물·거래일 뒤 일봉은 뺀다', () => {
    const result = buildContractLines({
      contracts: CONTRACTS.slice(0, 1),
      tradeDate: '2026-10-21',
      bars: [
        { ...bar('CLZ26', '2026-10-21', 71), revisedAt: at('2026-10-22T13:00:00Z') },
        bar('CLZ26', '2026-10-22', 73),
        bar('CLF27', '2026-10-20', 72),
      ],
      snapshots: [],
    });
    expect(result.dates).toEqual(['2026-10-21']);
    expect(result.lines).toHaveLength(1);
    expect(result.asOf).toEqual(at('2026-10-22T13:00:00Z'));
  });

  it('값이 하나도 없으면 날짜가 비고 asOf는 null이다', () => {
    const result = buildContractLines({
      contracts: CONTRACTS,
      tradeDate: '2026-10-22',
      bars: [],
      snapshots: [],
    });
    expect(result).toMatchObject({ dates: [], provisional: false, asOf: null });
    expect(result.lines.map((l) => l.prices)).toEqual([[], []]);
  });
});

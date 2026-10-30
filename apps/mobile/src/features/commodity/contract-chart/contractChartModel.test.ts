import type { ContractsChart } from '@futureetp/shared';
import { colors } from '@/theme/tokens';
import { contractChartModel, visibleEndLabels } from './contractChartModel';

const chart = (contracts: ContractsChart['contracts']): ContractsChart => ({
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: null,
  },
  priceDecimals: 3,
  dates: ['2026-10-20', '2026-10-21', '2026-10-22'],
  provisional: true,
  hasMore: false,
  contracts,
});

describe('contractChartModel', () => {
  const model = contractChartModel(
    chart([
      { symbol: 'NGZ26', contractMonth: '2026-12', prices: [3.1, 3.2, 3.3] },
      { symbol: 'NGF27', contractMonth: '2027-01', prices: [null, 3.5, null] },
    ]),
  );

  it('선마다 만기순 순번 색을 쓴다', () => {
    expect(model.lines.map((l) => [l.key, l.color])).toEqual([
      ['NGZ26', colors.chart.contractLines[0]],
      ['NGF27', colors.chart.contractLines[1]],
    ]);
  });

  it('날짜마다 값이 있는 선들로 위·아래 끝을 정한다', () => {
    expect(model.envelope).toEqual({ hi: [3.1, 3.5, 3.3], lo: [3.1, 3.2, 3.3] });
  });

  it('끝값 라벨은 보이는 범위에서 각 선의 마지막 값과 월물명이다', () => {
    const data = chart([
      { symbol: 'NGZ26', contractMonth: '2026-12', prices: [3.1, 3.2, 3.3] },
      { symbol: 'NGF27', contractMonth: '2027-01', prices: [null, 3.5, null] },
    ]);
    expect(visibleEndLabels(data, 0, 2)).toEqual([
      { key: 'NGZ26', price: 3.3, color: colors.chart.contractLines[0], suffix: 'DEC26' },
      { key: 'NGF27', price: 3.5, color: colors.chart.contractLines[1], suffix: 'JAN27' },
    ]);
    // 과거로 옮기면 그 범위 끝의 값
    expect(visibleEndLabels(data, 0, 1).map((l) => l.price)).toEqual([3.2, 3.5]);
    // 범위 안에 값이 없는 선은 라벨이 없다
    expect(visibleEndLabels(data, 0, 0).map((l) => l.key)).toEqual(['NGZ26']);
  });

  it('값이 하나도 없는 선은 끝값 라벨이 없다', () => {
    const empty = chart([
      { symbol: 'NGZ26', contractMonth: '2026-12', prices: [null, null, null] },
    ]);
    expect(visibleEndLabels(empty, 0, 2)).toEqual([]);
    expect(contractChartModel(empty).widestLabels).toEqual([]);
  });

  it('너비용 라벨은 선마다 글자가 가장 긴 값이다(음수 포함)', () => {
    const wide = contractChartModel(
      chart([{ symbol: 'CLK20', contractMonth: '2020-05', prices: [18.27, -37.63, 10.01] }]),
    );
    expect(wide.widestLabels.map((l) => l.price)).toEqual([-37.63]);
    expect(model.widestLabels.map((l) => l.price)).toEqual([3.3, 3.5]);
  });

  it('6번째 이후 선은 마지막 색을 같이 쓴다', () => {
    const many = contractChartModel(
      chart(
        Array.from({ length: 7 }, (_, i) => ({
          symbol: `S${i}`,
          contractMonth: '2027-01',
          prices: [1, 1, 1],
        })),
      ),
    );
    expect(many.lines[6].color).toBe(colors.chart.contractLines[5]);
  });
});

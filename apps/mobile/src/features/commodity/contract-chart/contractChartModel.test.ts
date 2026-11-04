import type { ContractsChart } from '@futureetp/shared';
import { colors } from '@/theme/tokens';
import { contractChartModel, endsRollYieldPct, visibleEndLabels } from './contractChartModel';

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
      {
        symbol: 'NGZ26',
        contractMonth: '2026-12',
        lastTradeDate: '2026-11-25',
        isFront: true,
        prices: [3.1, 3.2, 3.3],
      },
      {
        symbol: 'NGF27',
        contractMonth: '2027-01',
        lastTradeDate: '2026-12-28',
        isFront: false,
        prices: [null, 3.5, null],
      },
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

  it('범례는 만기순 선 색과 월물명이고, 대표월물에 ●을 붙인다', () => {
    expect(model.legend).toEqual([
      { key: 'NGZ26', color: colors.chart.contractLines[0], label: 'DEC26●' },
      { key: 'NGF27', color: colors.chart.contractLines[1], label: 'JAN27' },
    ]);
  });

  it('끝값 라벨은 보이는 범위에서 각 선의 마지막 값이다', () => {
    const data = chart([
      {
        symbol: 'NGZ26',
        contractMonth: '2026-12',
        lastTradeDate: '2026-11-25',
        isFront: true,
        prices: [3.1, 3.2, 3.3],
      },
      {
        symbol: 'NGF27',
        contractMonth: '2027-01',
        lastTradeDate: '2026-12-28',
        isFront: false,
        prices: [null, 3.5, null],
      },
    ]);
    expect(visibleEndLabels(data, 0, 2)).toEqual([
      { key: 'NGZ26', price: 3.3, color: colors.chart.contractLines[0] },
      { key: 'NGF27', price: 3.5, color: colors.chart.contractLines[1] },
    ]);
    // 과거로 옮기면 그 범위 끝의 값
    expect(visibleEndLabels(data, 0, 1).map((l) => l.price)).toEqual([3.2, 3.5]);
    // 범위 안에 값이 없는 선은 라벨이 없다
    expect(visibleEndLabels(data, 0, 0).map((l) => l.key)).toEqual(['NGZ26']);
  });

  it('값이 하나도 없는 선은 끝값 라벨이 없다', () => {
    const empty = chart([
      {
        symbol: 'NGZ26',
        contractMonth: '2026-12',
        lastTradeDate: '2026-11-25',
        isFront: true,
        prices: [null, null, null],
      },
    ]);
    expect(visibleEndLabels(empty, 0, 2)).toEqual([]);
    expect(contractChartModel(empty).widestLabels).toEqual([]);
  });

  it('너비용 라벨은 선마다 글자가 가장 긴 값이다(음수 포함)', () => {
    const wide = contractChartModel(
      chart([
        {
          symbol: 'CLK20',
          contractMonth: '2020-05',
          lastTradeDate: '2020-04-21',
          isFront: true,
          prices: [18.27, -37.63, 10.01],
        },
      ]),
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
          lastTradeDate: '2026-12-28',
          isFront: false,
          prices: [1, 1, 1],
        })),
      ),
    );
    expect(many.lines[6].color).toBe(colors.chart.contractLines[5]);
  });

  it('롤 수익률은 그날 양끝 월물의 연환산 (near / far − 1) × 365 / 만기 간격이다', () => {
    const data = chart([
      {
        symbol: 'NGZ26',
        contractMonth: '2026-12',
        lastTradeDate: '2026-11-25',
        isFront: true,
        prices: [3.3, 3.3, 3.3],
      },
      {
        symbol: 'NGF27',
        contractMonth: '2027-01',
        lastTradeDate: '2026-12-28',
        isFront: false,
        prices: [null, 3.0, null],
      },
      {
        symbol: 'NGG27',
        contractMonth: '2027-02',
        lastTradeDate: '2027-01-27',
        isFront: false,
        prices: [null, 3.0, 3.0],
      },
    ]);
    // 값이 하나뿐이면 없다
    expect(endsRollYieldPct(data, 0)).toBeNull();
    // 가장 먼 값은 NGG27(63일): (3.3 / 3.0 − 1) × 365 / 63 × 100
    expect(endsRollYieldPct(data, 1)).toBeCloseTo((0.1 * 365 * 100) / 63);
    // 가운데 월물이 비어도 양끝으로 센다
    expect(endsRollYieldPct(data, 2)).toBeCloseTo((0.1 * 365 * 100) / 63);
  });

  it('롤 수익률은 값이 0 이하이거나 만기가 같으면 없다', () => {
    const data = chart([
      {
        symbol: 'A',
        contractMonth: '2026-12',
        lastTradeDate: '2026-11-25',
        isFront: true,
        prices: [-1, 3, 3],
      },
      {
        symbol: 'B',
        contractMonth: '2027-01',
        lastTradeDate: '2026-12-28',
        isFront: false,
        prices: [3, null, null],
      },
      {
        symbol: 'C',
        contractMonth: '2027-01',
        lastTradeDate: '2026-11-25',
        isFront: false,
        prices: [null, null, 3],
      },
    ]);
    expect(endsRollYieldPct(data, 0)).toBeNull();
    expect(endsRollYieldPct(data, 2)).toBeNull();
  });
});

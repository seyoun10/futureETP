import { MAX_CHART_BARS } from '@/charts/chartPeriods';
import type { DisparityBar, DisparityChart } from '@futureetp/shared';
import { colors } from '@/theme/tokens';
import { disparityChartModel, formatTailPct, holdingsText } from './disparityChartModel';
import { chartBars } from './disparitySeries';

const bar = (
  tradeDate: string,
  close: number,
  extra: Partial<DisparityBar> = {},
): DisparityBar => ({
  tradeDate,
  open: close,
  high: close + 1,
  low: close - 1,
  close,
  ma: close,
  disparity: 0,
  inRoll: false,
  holdings: [{ contractMonth: '2026-12', weight: 1 }],
  ...extra,
});

const chart = (overrides: Partial<DisparityChart>): DisparityChart => ({
  freshness: {
    asOf: '2026-10-22T14:45:00Z',
    tradeDate: '2026-10-22',
    delayed: true,
    marketState: 'OPEN',
    nextUpdateAt: null,
  },
  priceDecimals: 1,
  basis: 'KR',
  fallback: false,
  maPeriod: 200,
  window: 'Y10',
  distribution: null,
  rareLevels: [
    { direction: 'UP', level: 5, disparity: 10, price: null },
    { direction: 'UP', level: 25, disparity: 4, price: null },
    { direction: 'DOWN', level: 5, disparity: -10, price: null },
    { direction: 'DOWN', level: 25, disparity: -4, price: null },
  ],
  currentTail: null,
  provisional: false,
  bars: [bar('2026-10-21', 100), bar('2026-10-22', 102)],
  ...overrides,
});

describe('disparityChartModel', () => {
  it('밴드 색은 순위로 고르고(드물수록 진함) 이평선은 굵은 노랑으로 마지막에 그린다', () => {
    const { lines } = disparityChartModel(chart({}));

    expect(lines.map((l) => [l.key, l.color])).toEqual([
      ['UP-5', colors.chart.rareLevels[1]],
      ['UP-25', colors.chart.rareLevels[0]],
      ['DOWN-5', colors.chart.rareLevels[1]],
      ['DOWN-25', colors.chart.rareLevels[0]],
      ['ma', colors.chart.movingAverage],
    ]);
    expect(lines[4].strokeWidth).toBeGreaterThan(lines[0].strokeWidth);
  });

  it('y축 특수 라벨은 현재가 회색, 이평선 노랑, 밴드는 선과 같은 색이다', () => {
    const { priceLabels } = disparityChartModel(chart({}));

    expect(priceLabels.slice(0, 2)).toEqual([
      { key: 'current', price: 102, color: colors.chart.currentPrice },
      { key: 'ma', price: 102, color: colors.chart.movingAverage },
    ]);
    expect(priceLabels.find((l) => l.key === 'UP-5')?.color).toBe(colors.chart.rareLevels[1]);
  });

  it('한국형·미국형은 롤 음영, 대표월물은 전환일 세로 점선을 그린다', () => {
    const rolling = [
      bar('2026-10-20', 100),
      bar('2026-10-21', 101, { inRoll: true }),
      bar('2026-10-22', 102, { holdings: [{ contractMonth: '2027-02', weight: 1 }] }),
    ];

    expect(disparityChartModel(chart({ bars: rolling })).roll).toEqual({
      shading: [[1, 1]],
      switches: [],
    });
    const front = disparityChartModel(chart({ basis: 'FRONT', bars: rolling }));
    expect(front.roll).toEqual({ shading: [], switches: [1] });
    expect([...front.frontSwitchAt]).toEqual([[1, 'FEB27']]);
    expect(disparityChartModel(chart({ bars: rolling })).frontSwitchAt.size).toBe(0);
  });
});

describe('holdingsText', () => {
  const [b] = chartBars([
    bar('2026-10-22', 100, {
      holdings: [
        { contractMonth: '2026-12', weight: 0.6 },
        { contractMonth: '2027-01', weight: 0.4 },
      ],
    }),
  ]);

  it('한국형·미국형은 월물별 비중, 대표월물은 월물명이다', () => {
    expect(holdingsText(b, 'KR')).toBe('DEC26 60% · JAN27 40%');
    expect(holdingsText(b, 'FRONT')).toBe('DEC26');
  });

  it('보유 월물이 없으면(첫날) null', () => {
    expect(holdingsText({ ...b, holdings: [] }, 'KR')).toBeNull();
  });
});

describe('formatTailPct', () => {
  it('1% 이상은 정수, 미만은 소수 첫째 자리', () => {
    expect(formatTailPct(9.4)).toBe('9');
    expect(formatTailPct(0.42)).toBe('0.4');
  });
});

describe('disparityChartModel 봉 수', () => {
  it('최근 MAX_CHART_BARS 봉만 그린다', () => {
    const bars = Array.from({ length: MAX_CHART_BARS + 3 }, (_, i) =>
      bar(`2020-01-${String(i).padStart(4, '0')}`, 100 + i),
    );
    const model = disparityChartModel(chart({ bars }));
    expect(model.bars).toHaveLength(MAX_CHART_BARS);
    expect(model.bars[0].close).toBe(103);
  });
});

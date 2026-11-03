import type { DisparityBar, DisparityChart } from '@futureetp/shared';
import {
  bandLines,
  chartBars,
  chartEnvelope,
  frontSwitches,
  rollSegments,
  visibleStats,
} from './disparitySeries';

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
  ma: null,
  disparity: null,
  inRoll: false,
  holdings: [],
  ...extra,
});

const rare = (
  direction: 'UP' | 'DOWN',
  level: number,
  disparity: number,
): DisparityChart['rareLevels'][number] => ({ direction, level, disparity, price: null });

describe('chartBars', () => {
  it('OHLC 중 하나라도 없는 봉은 뺀다', () => {
    const bars = [
      bar('2026-10-20', 10),
      bar('2026-10-21', 11, { close: null }),
      bar('2026-10-22', 12),
    ];
    expect(chartBars(bars).map((b) => b.tradeDate)).toEqual(['2026-10-20', '2026-10-22']);
  });
});

describe('bandLines', () => {
  const bars = chartBars([bar('2026-10-20', 10), bar('2026-10-21', 11, { ma: 100 })]);
  const bands = bandLines(bars, [rare('UP', 5, 20), rare('UP', 10, 10), rare('DOWN', 5, -20)]);

  it('이평선 × (1 + 레벨 이격도/100)이고 이평선이 없는 날은 null이다', () => {
    expect(bands[0].values).toEqual([null, 120]);
    expect(bands[2].values).toEqual([null, 80]);
  });

  it('같은 방향에서 작은 레벨(드묾)일수록 순위가 높다', () => {
    expect(bands.map((b) => [b.key, b.rank])).toEqual([
      ['UP-5', 1],
      ['UP-10', 0],
      ['DOWN-5', 0],
    ]);
  });
});

describe('chartEnvelope', () => {
  it('봉 고가·저가와 그날 이평선·밴드 중 끝값을 고른다', () => {
    const bars = chartBars([bar('2026-10-20', 10), bar('2026-10-21', 100, { ma: 100 })]);
    const bands = bandLines(bars, [rare('UP', 5, 20), rare('DOWN', 5, -20)]);
    expect(chartEnvelope(bars, bands)).toEqual({ hi: [11, 120], lo: [9, 80] });
  });
});

describe('rollSegments', () => {
  it('이어진 롤 중 봉을 구간 하나로 묶는다', () => {
    const bars = chartBars(
      [false, true, true, false, true].map((inRoll, i) => bar(`2026-10-${10 + i}`, 10, { inRoll })),
    );
    expect(rollSegments(bars)).toEqual([
      [1, 2],
      [4, 4],
    ]);
  });
});

describe('frontSwitches', () => {
  it('보유 월물이 바뀐 봉의 앞 봉(전환일)에 새 월물을 단다', () => {
    const hold = (contractMonth: string) => ({ holdings: [{ contractMonth, weight: 1 }] });
    const bars = chartBars([
      bar('2026-10-20', 10),
      bar('2026-10-21', 10, hold('2026-12')),
      bar('2026-10-22', 10, hold('2026-12')),
      bar('2026-10-23', 10, hold('2027-02')),
    ]);
    expect(frontSwitches(bars)).toEqual([{ index: 2, contractMonth: '2027-02' }]);
  });
});

describe('visibleStats', () => {
  const bars = chartBars([bar('a', 10), bar('b', 21), bar('c', 5), bar('d', 15)]);

  it('보이는 구간의 최고가·최저가 봉과 현재가 대비 %를 준다', () => {
    const stats = visibleStats(bars, 0, 3);
    expect(stats).toMatchObject({ highIndex: 1, lowIndex: 2 });
    expect(stats?.fromLowPct).toBeCloseTo(275);
    expect(stats?.fromHighPct).toBeCloseTo(-31.818, 2);
  });

  it('보이는 구간만 본다', () => {
    expect(visibleStats(bars, 2, 3)).toMatchObject({ highIndex: 3, lowIndex: 2 });
  });
});

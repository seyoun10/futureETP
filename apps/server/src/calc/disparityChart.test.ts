import { describe, expect, it } from 'vitest';
import { buildDisparityChart, roundDisparityChart } from './disparityChart.ts';
import type { DisparityChartInput, StoredIndexBar } from './disparityChart.ts';

const bar = (tradeDate: string, close: number | null, inRollPeriod = false): StoredIndexBar => ({
  tradeDate,
  open: close === null ? null : close - 1,
  high: close === null ? null : close + 2,
  low: close === null ? null : close - 2,
  close,
  inRollPeriod,
});

const BASE: DisparityChartInput = {
  maPeriod: 2,
  levels: [5, 10],
  bars: [bar('2026-10-19', 100), bar('2026-10-20', null), bar('2026-10-21', 110, true)],
  // 산출 불가일(10/20)은 행이 없다
  disparities: [
    { tradeDate: '2026-10-19', ma: null, disparity: null },
    { tradeDate: '2026-10-21', ma: 105, disparity: 4.76 },
  ],
  weights: [
    { tradeDate: '2026-10-19', contractMonth: '2026-12', weight: 1 },
    { tradeDate: '2026-10-20', contractMonth: '2026-12', weight: 1 },
    { tradeDate: '2026-10-21', contractMonth: '2027-01', weight: 0.2 },
    { tradeDate: '2026-10-21', contractMonth: '2026-12', weight: 0.8 },
  ],
  ratio: 2,
  snapshot: null,
  // 0~10 균등
  sortedValues: [0, 2, 4, 6, 8, 10],
};

describe('buildDisparityChart', () => {
  it('저장된 봉에 맞춤 비율을 곱하고, 보유 월물은 직전 거래일 종가 뒤 비중을 만기순으로 붙인다', () => {
    const { bars, provisional } = buildDisparityChart(BASE);

    expect(provisional).toBe(false);
    expect(bars.map((b) => b.tradeDate)).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
    expect(bars[0]).toEqual({
      tradeDate: '2026-10-19',
      open: 198,
      high: 204,
      low: 196,
      close: 200,
      ma: null,
      disparity: null,
      inRoll: false,
      holdings: [],
    });
    // 산출 불가일
    expect(bars[1]).toMatchObject({ close: null, ma: null, disparity: null });
    expect(bars[2]).toMatchObject({ close: 220, ma: 210, disparity: 4.76, inRoll: true });
    expect(bars[2].holdings).toEqual([{ contractMonth: '2026-12', weight: 1 }]);
  });

  it('rare 레벨은 위 방향 오름차순 → 아래 방향 오름차순이고, 가격은 마지막 봉 이평선의 밴드다', () => {
    const { rareLevels, currentTail } = buildDisparityChart(BASE);

    expect(rareLevels.map((l) => [l.direction, l.level])).toEqual([
      ['UP', 5],
      ['UP', 10],
      ['DOWN', 5],
      ['DOWN', 10],
    ]);
    // 95번째 백분위 = 9.5, 이평선 210 × 1.095
    expect(rareLevels[0].disparity).toBeCloseTo(9.5);
    expect(rareLevels[0].price).toBeCloseTo(229.95);
    expect(rareLevels[3].disparity).toBeCloseTo(1);
    // 4.76은 순위 47.6 → 하위
    expect(currentTail?.side).toBe('DOWN');
    expect(currentTail?.pct).toBeCloseTo(47.6);
  });

  it('저장된 마지막 봉 뒤 거래일의 스냅숏은 오늘 잠정 봉이 되고, 이평선·이격도를 직전 유효 종가로 만든다', () => {
    const { bars, provisional, currentTail } = buildDisparityChart({
      ...BASE,
      snapshot: {
        tradeDate: '2026-10-22',
        capturedAt: new Date('2026-10-22T14:45:00Z'),
        open: 111,
        high: 125,
        low: 109,
        last: 120,
      },
    });

    expect(provisional).toBe(true);
    const today = bars[bars.length - 1];
    // 이평선 (110 + 120) / 2 = 115, 이격도 (120 / 115 − 1) × 100
    expect(today).toMatchObject({ tradeDate: '2026-10-22', open: 222, close: 240, ma: 230 });
    expect(today.disparity).toBeCloseTo(4.3478);
    // 10/21 종가 뒤 비중이 둘로 나뉘어 롤 중
    expect(today.inRoll).toBe(true);
    expect(today.holdings).toEqual([
      { contractMonth: '2026-12', weight: 0.8 },
      { contractMonth: '2027-01', weight: 0.2 },
    ]);
    expect(currentTail?.side).toBe('DOWN');
  });

  it('저장된 마지막 봉과 같은 거래일이거나 가격이 없는 스냅숏은 쓰지 않는다', () => {
    const snapshot = {
      capturedAt: new Date('2026-10-21T20:45:00Z'),
      open: null,
      high: null,
      low: null,
    };
    for (const s of [
      { ...snapshot, tradeDate: '2026-10-21', last: 130 },
      { ...snapshot, tradeDate: '2026-10-22', last: null },
    ]) {
      const result = buildDisparityChart({ ...BASE, snapshot: s });
      expect(result.provisional).toBe(false);
      expect(result.bars).toHaveLength(3);
    }
  });

  it('분포가 없으면 rare 레벨·꼬리 백분위가 없고, 맞춤 비율이 없으면 봉도 없다', () => {
    expect(buildDisparityChart({ ...BASE, sortedValues: null })).toMatchObject({
      rareLevels: [],
      currentTail: null,
    });
    expect(buildDisparityChart({ ...BASE, ratio: null })).toEqual({
      bars: [],
      rareLevels: [],
      currentTail: null,
      provisional: false,
    });
  });
});

describe('roundDisparityChart', () => {
  it('가격은 표시 자릿수+2, 이격도·백분위는 3자리로 반올림하고 null은 그대로 둔다', () => {
    const chart = roundDisparityChart(
      {
        bars: [
          {
            tradeDate: '2026-10-21',
            open: 101.96000000000001,
            high: null,
            low: 99.123456,
            close: 100.000049,
            ma: 3.5763059453574564,
            disparity: -15.247743165411764,
            inRoll: false,
            holdings: [{ contractMonth: '2026-12', weight: 1 }],
          },
        ],
        rareLevels: [{ direction: 'UP', level: 1, disparity: 50.66927245017293, price: null }],
        currentTail: { side: 'DOWN', pct: 24.27554663826406 },
        provisional: false,
      },
      2,
    );

    expect(chart.bars[0]).toMatchObject({
      open: 101.96,
      high: null,
      low: 99.1235,
      close: 100,
      ma: 3.5763,
      disparity: -15.248,
    });
    expect(chart.rareLevels[0]).toMatchObject({ disparity: 50.669, price: null });
    expect(chart.currentTail).toEqual({ side: 'DOWN', pct: 24.276 });
  });
});

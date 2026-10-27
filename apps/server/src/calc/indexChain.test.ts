// 명세(docs/product.md "계산 정의 > 시계열", D-004, indexChain 명세)만 보고 작성한 테스트(D-057).
import { describe, expect, it } from 'vitest';
import {
  buildIndexBars,
  chainIndex,
  indexScaleRatio,
  type DayBar,
  type IndexBarRow,
  type IndexInputDay,
} from './indexChain.ts';

// settle만 주면 open/high/low는 null(거래 없던 월물)
function bar(
  settle: number,
  open: number | null = null,
  high: number | null = null,
  low: number | null = null,
): DayBar {
  return { open, high, low, settle };
}

function day(
  tradeDate: string,
  bars: Record<string, DayBar>,
  weights: Record<string, number>,
  inRollPeriod = false,
): IndexInputDay {
  return {
    tradeDate,
    bars: new Map(Object.entries(bars)),
    weights: Object.entries(weights).map(([symbol, weight]) => ({ symbol, weight })),
    inRollPeriod,
  };
}

function row(close: number | null, blendedPrice: number, isValid = close !== null): IndexBarRow {
  return {
    tradeDate: '2026-01-02',
    open: close,
    high: close,
    low: close,
    close,
    blendedPrice,
    isValid,
    inRollPeriod: false,
  };
}

describe('buildIndexBars: 월물 하나, 롤 없음', () => {
  const days = [
    day('2026-01-05', { A: bar(50, 49, 52, 48) }, { A: 1 }),
    day('2026-01-06', { A: bar(55, 51, 56, 50) }, { A: 1 }),
    day('2026-01-07', { A: bar(44, 54, 55, 43) }, { A: 1 }),
  ];

  it('첫날 close는 혼합 가격, 시가·고가·저가는 같은 비중으로 혼합한다', () => {
    const [first] = buildIndexBars(days);
    expect(first).toMatchObject({
      tradeDate: '2026-01-05',
      open: 49,
      high: 52,
      low: 48,
      close: 50,
      blendedPrice: 50,
      isValid: true,
      inRollPeriod: false,
    });
  });

  it('지수 수익률이 정산가 수익률과 정확히 같다', () => {
    const rows = buildIndexBars(days);
    expect(rows).toHaveLength(3);
    expect(rows[1].close).toBeCloseTo(55, 10);
    expect(rows[2].close).toBeCloseTo(44, 10);
    expect(rows[2].close! / rows[1].close!).toBeCloseTo(44 / 55, 12);
  });

  it('다음 날들의 시가·고가·저가도 같은 배율로 이어진다', () => {
    const rows = buildIndexBars(days);
    expect(rows[1].open).toBeCloseTo(51, 10);
    expect(rows[1].high).toBeCloseTo(56, 10);
    expect(rows[1].low).toBeCloseTo(50, 10);
    expect(rows[2].open).toBeCloseTo(54, 10);
    expect(rows[2].high).toBeCloseTo(55, 10);
    expect(rows[2].low).toBeCloseTo(43, 10);
    expect(rows.every((r) => r.isValid)).toBe(true);
  });
});

describe('buildIndexBars: 두 월물 롤', () => {
  it('콘탱고(50 → 60) 월물 교체에도 지수가 뛰지 않는다', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(50), B: bar(60) }, { A: 1 }),
      // 이날 종가 뒤 B로 모두 넘어감. 이날 수익률은 w(t-1) = A
      day('2026-01-06', { A: bar(50), B: bar(60) }, { B: 1 }),
      day('2026-01-07', { A: bar(51), B: bar(66) }, { B: 1 }),
    ]);
    expect(rows[0].close).toBeCloseTo(50, 10);
    expect(rows[1].close).toBeCloseTo(50, 10);
    expect(rows[1].blendedPrice).toBeCloseTo(60, 10);
    // 50 × 66 / 60
    expect(rows[2].close).toBeCloseTo(55, 10);
    expect(rows[2].blendedPrice).toBeCloseTo(66, 10);
  });

  it('부분 롤: 분자·분모에 같은 w(t-1)을 쓴다', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(50, 49, 51, 48), B: bar(60, 59, 61, 58) }, { A: 1 }),
      day(
        '2026-01-06',
        { A: bar(50, 49, 51, 48), B: bar(60, 59, 61, 58) },
        { A: 0.5, B: 0.5 },
        true,
      ),
      day('2026-01-07', { A: bar(55, 54, 56, 53), B: bar(66, 64, 67, 63) }, { B: 1 }, true),
      day('2026-01-08', { A: bar(50), B: bar(72) }, { B: 1 }),
    ]);
    expect(rows[1].close).toBeCloseTo(50, 10);
    expect(rows[1].blendedPrice).toBeCloseTo(55, 10);
    // N = 0.5·55 + 0.5·66 = 60.5, close = 50 × 60.5 / 55
    expect(rows[2].close).toBeCloseTo(55, 10);
    // 시가 = 50 × (0.5·54 + 0.5·64) / 55
    expect(rows[2].open).toBeCloseTo((50 * 59) / 55, 10);
    expect(rows[2].high).toBeCloseTo((50 * 61.5) / 55, 10);
    expect(rows[2].low).toBeCloseTo((50 * 58) / 55, 10);
    expect(rows[2].blendedPrice).toBeCloseTo(66, 10);
    // 55 × 72 / 66
    expect(rows[3].close).toBeCloseTo(60, 10);
  });

  it('blendedPrice는 그날 종가 뒤 비중 w(t)로 Σ w·settle', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(40), B: bar(80) }, { A: 0.25, B: 0.75 }),
      day('2026-01-06', { A: bar(44), B: bar(90) }, { A: 0.5, B: 0.5 }),
    ]);
    expect(rows[0].blendedPrice).toBeCloseTo(70, 10);
    expect(rows[0].close).toBeCloseTo(70, 10);
    // 그날 비중 0.5/0.5로 저장
    expect(rows[1].blendedPrice).toBeCloseTo(67, 10);
    // N = 0.25·44 + 0.75·90 = 78.5 → 70 × 78.5 / 70
    expect(rows[1].close).toBeCloseTo(78.5, 10);
  });
});

describe('buildIndexBars: 음수 가격과 무효일', () => {
  it('월물 하나가 음수여도 혼합이 양수면 유효하다', () => {
    const rows = buildIndexBars([
      day('2020-04-17', { A: bar(20), B: bar(30) }, { A: 0.5, B: 0.5 }),
      day('2020-04-20', { A: bar(-10), B: bar(40) }, { A: 0.5, B: 0.5 }),
    ]);
    expect(rows[0].close).toBeCloseTo(25, 10);
    expect(rows[1].isValid).toBe(true);
    expect(rows[1].blendedPrice).toBeCloseTo(15, 10);
    // 25 × 15 / 25
    expect(rows[1].close).toBeCloseTo(15, 10);
  });

  it('N ≤ 0이면 무효: OHLC null, blendedPrice는 저장, 다음 유효일은 직전 유효일 기준', () => {
    const rows = buildIndexBars([
      day('2020-04-17', { A: bar(20) }, { A: 1 }),
      day('2020-04-20', { A: bar(-37.63, 17, 18, -40) }, { A: 1 }),
      day('2020-04-21', { A: bar(10) }, { A: 1 }),
    ]);
    expect(rows[1]).toMatchObject({
      open: null,
      high: null,
      low: null,
      close: null,
      isValid: false,
    });
    expect(rows[1].blendedPrice).toBeCloseTo(-37.63, 10);
    // v = 04-17: 20 × 10 / 20
    expect(rows[2].isValid).toBe(true);
    expect(rows[2].close).toBeCloseTo(10, 10);
  });

  it('무효일 다음 N은 v가 아니라 바로 전 입력 행(무효일)의 비중을 쓴다', () => {
    const rows = buildIndexBars([
      day('2020-04-17', { A: bar(20), B: bar(25) }, { A: 1 }),
      // 무효일에 B로 롤. N = 1·(−37.63) ≤ 0
      day('2020-04-20', { A: bar(-37.63), B: bar(25) }, { B: 1 }),
      day('2020-04-21', { A: bar(15), B: bar(30) }, { B: 1 }),
    ]);
    expect(rows[1].isValid).toBe(false);
    expect(rows[1].blendedPrice).toBeCloseTo(25, 10);
    // N = w(04-20)=B → 30, close = 20 × 30 / B(v)=20 (v 비중 A로 하면 15)
    expect(rows[2].close).toBeCloseTo(30, 10);
  });

  it('N > 0이어도 B(t) ≤ 0이면 무효', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(20), B: bar(10) }, { A: 1 }),
      // N = 1·22 > 0, B(t) = 1·(−5)
      day('2026-01-06', { A: bar(22), B: bar(-5) }, { B: 1 }),
      day('2026-01-07', { A: bar(23), B: bar(8) }, { B: 1 }),
    ]);
    expect(rows[1]).toMatchObject({
      open: null,
      high: null,
      low: null,
      close: null,
      isValid: false,
    });
    expect(rows[1].blendedPrice).toBeCloseTo(-5, 10);
    // v = 01-05: 20 × 8 / 20
    expect(rows[2].close).toBeCloseTo(8, 10);
  });

  it('첫날 B ≤ 0이면 무효, B > 0인 다음 날이 시작(close = B)', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(-5) }, { A: 1 }),
      day('2026-01-06', { A: bar(12, 11, 13, 10), B: bar(20) }, { A: 0.5, B: 0.5 }),
      day('2026-01-07', { A: bar(14), B: bar(22) }, { A: 0.5, B: 0.5 }),
    ]);
    expect(rows[0]).toMatchObject({
      close: null,
      open: null,
      high: null,
      low: null,
      isValid: false,
    });
    expect(rows[0].blendedPrice).toBeCloseTo(-5, 10);
    expect(rows[1].isValid).toBe(true);
    expect(rows[1].close).toBeCloseTo(16, 10);
    // 시작일 시가 = Σ w(t)·O, B는 settle로 대신
    expect(rows[1].open).toBeCloseTo(15.5, 10);
    expect(rows[1].high).toBeCloseTo(16.5, 10);
    expect(rows[1].low).toBeCloseTo(15, 10);
    // 16 × 18 / 16
    expect(rows[2].close).toBeCloseTo(18, 10);
  });
});

describe('buildIndexBars: 시가·고가·저가', () => {
  it('월물 open/high/low가 null이면 settle로 대신한다', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(50), B: bar(60, 58, 62, 57) }, { A: 0.5, B: 0.5 }),
      day('2026-01-06', { A: bar(52), B: bar(61, 60, 63, 59) }, { A: 0.5, B: 0.5 }),
    ]);
    expect(rows[0]).toMatchObject({ open: 54, high: 56, low: 53.5, close: 55 });
    // N = 56.5, 배율 55/55
    expect(rows[1].close).toBeCloseTo(56.5, 10);
    expect(rows[1].open).toBeCloseTo(56, 10);
    expect(rows[1].high).toBeCloseTo(57.5, 10);
    expect(rows[1].low).toBeCloseTo(55.5, 10);
  });

  it('유효일의 혼합 저가가 0 이하이면 low만 null', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(5, 5, 6, 4) }, { A: 1 }),
      day('2026-01-06', { A: bar(2, 3, 4, -1) }, { A: 1 }),
    ]);
    expect(rows[1].isValid).toBe(true);
    expect(rows[1].low).toBeNull();
    expect(rows[1].open).toBeCloseTo(3, 10);
    expect(rows[1].high).toBeCloseTo(4, 10);
    expect(rows[1].close).toBeCloseTo(2, 10);
  });

  it('첫날 혼합 저가가 0 이하여도 low만 null', () => {
    const [first] = buildIndexBars([day('2026-01-05', { A: bar(2, 3, 4, 0) }, { A: 1 })]);
    expect(first).toMatchObject({ open: 3, high: 4, low: null, close: 2, isValid: true });
  });
});

describe('buildIndexBars: 입력 오류와 복사', () => {
  it('그날 비중이 있는 월물의 settle이 없으면 Error', () => {
    expect(() => buildIndexBars([day('2026-01-05', { A: bar(50) }, { A: 0.5, B: 0.5 })])).toThrow();
  });

  it('전일 비중 월물의 settle이 그날 없으면 Error', () => {
    expect(() =>
      buildIndexBars([
        day('2026-01-05', { A: bar(50), B: bar(60) }, { A: 1 }),
        day('2026-01-06', { B: bar(61) }, { B: 1 }),
      ]),
    ).toThrow();
  });

  it('weights가 빈 배열이면 Error', () => {
    expect(() => buildIndexBars([day('2026-01-05', { A: bar(50) }, {})])).toThrow();
  });

  it('inRollPeriod는 입력을 그대로 복사한다', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(50) }, { A: 1 }, false),
      day('2026-01-06', { A: bar(51) }, { A: 1 }, true),
      day('2026-01-07', { A: bar(-1) }, { A: 1 }, true),
      day('2026-01-08', { A: bar(52) }, { A: 1 }, false),
    ]);
    expect(rows.map((r) => r.inRollPeriod)).toEqual([false, true, true, false]);
    expect(rows.map((r) => r.tradeDate)).toEqual([
      '2026-01-05',
      '2026-01-06',
      '2026-01-07',
      '2026-01-08',
    ]);
  });

  it('빈 입력이면 빈 배열', () => {
    expect(buildIndexBars([])).toEqual([]);
  });
});

describe('chainIndex', () => {
  it('close(v) × Σ w·P / B(v)', () => {
    const prices: Record<string, number> = { A: 40, B: 70 };
    const value = chainIndex(
      100,
      50,
      [
        { symbol: 'A', weight: 0.5 },
        { symbol: 'B', weight: 0.5 },
      ],
      (s) => prices[s],
    );
    // 100 × 55 / 50
    expect(value).toBeCloseTo(110, 10);
  });
});

describe('indexScaleRatio', () => {
  it('마지막 유효 행의 blendedPrice / close', () => {
    expect(indexScaleRatio([row(100, 50), row(110, 66)])).toBeCloseTo(0.6, 12);
  });

  it('마지막 행이 무효면 그 앞 마지막 유효 행의 비율', () => {
    expect(indexScaleRatio([row(100, 50), row(110, 66), row(null, -3), row(null, -1)])).toBeCloseTo(
      0.6,
      12,
    );
  });

  it('유효 행이 없으면 null', () => {
    expect(indexScaleRatio([row(null, -5), row(null, 0)])).toBeNull();
    expect(indexScaleRatio([])).toBeNull();
  });

  it('맞춤 지수의 마지막 유효일 값 = 그날 혼합 가격', () => {
    const rows = buildIndexBars([
      day('2026-01-05', { A: bar(50), B: bar(60) }, { A: 1 }),
      day('2026-01-06', { A: bar(50), B: bar(60) }, { B: 1 }),
      day('2026-01-07', { A: bar(51), B: bar(66) }, { B: 1 }),
      day('2026-01-08', { A: bar(52), B: bar(-2) }, { B: 1 }),
    ]);
    const ratio = indexScaleRatio(rows);
    expect(ratio).not.toBeNull();
    // 마지막 유효 = 01-07: close 55, blended 66
    expect(ratio!).toBeCloseTo(66 / 55, 12);
    expect(rows[2].close! * ratio!).toBeCloseTo(rows[2].blendedPrice, 10);
  });
});

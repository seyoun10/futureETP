// 명세(docs/product.md "이격도와 rare 레벨"·C-a 백분위 표시, D-067)만 보고 작성한 테스트(D-057).
import { describe, expect, it } from 'vitest';
import {
  buildDisparitySeries,
  buildDistribution,
  liveDisparity,
  percentile,
  percentileRank,
  rareLevelDisparity,
  rareLevelPrice,
  tailPercentile,
  windowStartExclusive,
  type CloseBar,
  type DisparityRow,
} from './disparity.ts';

function cb(tradeDate: string, close: number | null): CloseBar {
  return { tradeDate, close };
}

function dr(tradeDate: string, disparity: number | null, ma: number | null = 100): DisparityRow {
  return { tradeDate, ma, disparity };
}

describe('buildDisparitySeries', () => {
  it('처음 유효일부터 K−1개는 ma·disparity가 모두 null이다', () => {
    const rows = buildDisparitySeries(
      [cb('2026-01-02', 10), cb('2026-01-05', 20), cb('2026-01-06', 30)],
      3,
    );
    expect(rows.map((r) => r.tradeDate)).toEqual(['2026-01-02', '2026-01-05', '2026-01-06']);
    expect(rows[0]).toEqual({ tradeDate: '2026-01-02', ma: null, disparity: null });
    expect(rows[1]).toEqual({ tradeDate: '2026-01-05', ma: null, disparity: null });
    expect(rows[2].ma).toBeCloseTo(20);
    expect(rows[2].disparity).toBeCloseTo(50);
  });

  it('이격도 = (종가 / 이평선 − 1) × 100', () => {
    const rows = buildDisparitySeries(
      [cb('2026-01-02', 100), cb('2026-01-05', 100), cb('2026-01-06', 70)],
      3,
    );
    expect(rows[2].ma).toBeCloseTo(90);
    expect(rows[2].disparity).toBeCloseTo((70 / 90 - 1) * 100);
  });

  it('산출 불가일은 행을 내지 않고, 이평선 창은 유효 종가만 이어서 K개를 쓴다', () => {
    const rows = buildDisparitySeries(
      [
        cb('2026-01-02', 10),
        cb('2026-01-05', 20),
        cb('2026-01-06', null),
        cb('2026-01-07', 30),
        cb('2026-01-08', 40),
      ],
      3,
    );
    expect(rows.map((r) => r.tradeDate)).toEqual([
      '2026-01-02',
      '2026-01-05',
      '2026-01-07',
      '2026-01-08',
    ]);
    // 01-07: (10 + 20 + 30) / 3 — 산출 불가일 뒤에 초기 기간을 다시 두지 않는다
    expect(rows[2].ma).toBeCloseTo(20);
    expect(rows[2].disparity).toBeCloseTo(50);
    // 01-08: (20 + 30 + 40) / 3
    expect(rows[3].ma).toBeCloseTo(30);
    expect(rows[3].disparity).toBeCloseTo((40 / 30 - 1) * 100);
  });

  it('맨 앞의 산출 불가일은 초기 K−1개에 세지 않는다', () => {
    const rows = buildDisparitySeries(
      [cb('2026-01-02', null), cb('2026-01-05', 10), cb('2026-01-06', 20)],
      2,
    );
    expect(rows.map((r) => r.tradeDate)).toEqual(['2026-01-05', '2026-01-06']);
    expect(rows[0]).toEqual({ tradeDate: '2026-01-05', ma: null, disparity: null });
    expect(rows[1].ma).toBeCloseTo(15);
    expect(rows[1].disparity).toBeCloseTo((20 / 15 - 1) * 100);
  });

  it('K=1이면 첫 유효일부터 이평선 = 종가, 이격도 0', () => {
    const rows = buildDisparitySeries([cb('2026-01-02', 50)], 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].ma).toBeCloseTo(50);
    expect(rows[0].disparity).toBeCloseTo(0);
  });
});

describe('windowStartExclusive', () => {
  it('Y3/Y5/Y10은 기준 거래일에서 N년 뺀 날', () => {
    expect(windowStartExclusive('2026-10-27', 'Y3')).toBe('2023-10-27');
    expect(windowStartExclusive('2026-10-27', 'Y5')).toBe('2021-10-27');
    expect(windowStartExclusive('2026-10-27', 'Y10')).toBe('2016-10-27');
  });

  it('ALL이면 null', () => {
    expect(windowStartExclusive('2026-10-27', 'ALL')).toBeNull();
  });

  it('윤년 2월 29일은 N년 전 2월 28일로', () => {
    expect(windowStartExclusive('2024-02-29', 'Y3')).toBe('2021-02-28');
    expect(windowStartExclusive('2024-02-29', 'Y5')).toBe('2019-02-28');
    expect(windowStartExclusive('2024-02-29', 'Y10')).toBe('2014-02-28');
  });

  it('2월 28일 기준은 N년 전이 윤년이어도 2월 28일', () => {
    expect(windowStartExclusive('2027-02-28', 'Y3')).toBe('2024-02-28');
  });
});

describe('buildDistribution', () => {
  const series: DisparityRow[] = [
    dr('2023-10-26', 9, 100),
    dr('2023-10-27', 8), // 경계 당일 — 제외(초과만)
    dr('2023-10-29', null, null), // 이격도 없음 — 제외
    dr('2023-10-30', 3),
    dr('2025-06-02', -2),
    dr('2026-10-27', 1),
    dr('2026-10-28', 7), // 기준일 이후 — 제외
  ];

  it('경계 초과·기준일 이하의 null 아닌 이격도를 오름차순으로 모은다', () => {
    const d = buildDistribution(series, '2026-10-27', 'Y3');
    expect(d).toEqual({
      asOfTradeDate: '2026-10-27',
      actualStartDate: '2023-10-30',
      sampleCount: 3,
      sortedValues: [-2, 1, 3],
    });
  });

  it('ALL은 앞쪽 제한 없이 기준일 이하를 모두 쓴다', () => {
    const d = buildDistribution(series, '2026-10-27', 'ALL');
    expect(d).not.toBeNull();
    expect(d!.actualStartDate).toBe('2023-10-26');
    expect(d!.sampleCount).toBe(5);
    expect(d!.sortedValues).toEqual([-2, 1, 3, 8, 9]);
  });

  it('데이터가 N년보다 짧으면 있는 만큼 쓰고 actualStartDate가 실제 첫 표본일이다', () => {
    const d = buildDistribution(
      [dr('2026-01-02', null, null), dr('2026-01-05', 4), dr('2026-01-06', -1)],
      '2026-01-06',
      'Y10',
    );
    expect(d).toEqual({
      asOfTradeDate: '2026-01-06',
      actualStartDate: '2026-01-05',
      sampleCount: 2,
      sortedValues: [-1, 4],
    });
  });

  it('표본이 없으면 null', () => {
    expect(buildDistribution(series, '2023-10-20', 'ALL')).toBeNull();
    expect(buildDistribution([dr('2026-01-02', null, null)], '2026-01-02', 'Y3')).toBeNull();
    expect(buildDistribution([], '2026-01-02', 'ALL')).toBeNull();
  });
});

describe('percentile (numpy linear)', () => {
  const five = [10, 20, 30, 40, 50];
  const four = [1, 2, 4, 8];

  it('0·100 백분위는 최솟값·최댓값', () => {
    expect(percentile(five, 0)).toBeCloseTo(10);
    expect(percentile(five, 100)).toBeCloseTo(50);
  });

  it('h = q/100 × (n−1)로 선형 보간한다', () => {
    expect(percentile(five, 50)).toBeCloseTo(30); // h=2
    expect(percentile(five, 10)).toBeCloseTo(14); // h=0.4
    expect(percentile(five, 95)).toBeCloseTo(48); // h=3.8
    expect(percentile(four, 25)).toBeCloseTo(1.75); // h=0.75
    expect(percentile(four, 90)).toBeCloseTo(6.8); // h=2.7 → 4 + 0.7×4
    expect(percentile(four, 40)).toBeCloseTo(2.4); // h=1.2 → 2 + 0.2×2
  });

  it('표본 1개면 그 값', () => {
    expect(percentile([7], 0)).toBeCloseTo(7);
    expect(percentile([7], 37.5)).toBeCloseTo(7);
    expect(percentile([7], 100)).toBeCloseTo(7);
  });
});

describe('rareLevelDisparity / rareLevelPrice', () => {
  const five = [10, 20, 30, 40, 50];

  it('UP p% = percentile(100 − p), DOWN p% = percentile(p)', () => {
    expect(rareLevelDisparity(five, 'UP', 5)).toBeCloseTo(48);
    expect(rareLevelDisparity(five, 'DOWN', 5)).toBeCloseTo(12);
    expect(rareLevelDisparity(five, 'UP', 0.1)).toBeCloseTo(49.96); // h=3.996
    expect(rareLevelDisparity(five, 'DOWN', 49.9)).toBeCloseTo(29.96); // h=1.996
  });

  it('rare-level 가격 = 이평선 × (1 + 레벨 이격도 / 100)', () => {
    expect(rareLevelPrice(200, 5)).toBeCloseTo(210);
    expect(rareLevelPrice(200, -10)).toBeCloseTo(180);
    expect(rareLevelPrice(80, 0)).toBeCloseTo(80);
  });
});

describe('percentileRank', () => {
  const five = [10, 20, 30, 40, 50];
  const four = [1, 2, 4, 8];

  it('percentile의 역함수: percentile(q)의 순위는 q', () => {
    for (const q of [0, 5, 10, 33.3, 50, 72.5, 95, 100]) {
      expect(percentileRank(five, percentile(five, q))).toBeCloseTo(q);
    }
    for (const q of [0.1, 25, 40, 90, 99.9]) {
      expect(percentileRank(four, percentile(four, q))).toBeCloseTo(q);
    }
  });

  it('표본 사이 값은 선형 역보간', () => {
    expect(percentileRank(five, 14)).toBeCloseTo(10);
    expect(percentileRank(four, 6)).toBeCloseTo(83.3333); // h=2.5
  });

  it('같은 값이 여러 개면 그 순위 구간의 가운데', () => {
    // 2는 위치 1~3 → 25~75 구간
    expect(percentileRank([1, 2, 2, 2, 3], 2)).toBeCloseTo(50);
    // 5는 위치 0~1 → 0~33.33 구간
    expect(percentileRank([5, 5, 6, 7], 5)).toBeCloseTo(100 / 6);
  });

  it('범위 밖은 0 또는 100으로 자른다', () => {
    expect(percentileRank(five, 5)).toBe(0);
    expect(percentileRank(five, 60)).toBe(100);
  });

  it('표본 1개면 50', () => {
    expect(percentileRank([7], 7)).toBeCloseTo(50);
  });
});

describe('tailPercentile', () => {
  const five = [10, 20, 30, 40, 50];

  it('순위 > 50이면 상위(UP), pct = 100 − 순위', () => {
    const t = tailPercentile(five, 48); // 순위 95
    expect(t.side).toBe('UP');
    expect(t.pct).toBeCloseTo(5);
    const t2 = tailPercentile(five, 31); // 순위 52.5
    expect(t2.side).toBe('UP');
    expect(t2.pct).toBeCloseTo(47.5);
  });

  it('순위 ≤ 50이면 하위(DOWN), pct = 순위', () => {
    const t = tailPercentile(five, 12); // 순위 5
    expect(t.side).toBe('DOWN');
    expect(t.pct).toBeCloseTo(5);
  });

  it('순위가 정확히 50이면 DOWN 50', () => {
    const t = tailPercentile(five, 30);
    expect(t.side).toBe('DOWN');
    expect(t.pct).toBeCloseTo(50);
  });

  it('범위 밖: 최댓값 초과는 UP 0, 최솟값 미만은 DOWN 0', () => {
    const up = tailPercentile(five, 60);
    expect(up.side).toBe('UP');
    expect(up.pct).toBeCloseTo(0);
    const down = tailPercentile(five, 5);
    expect(down.side).toBe('DOWN');
    expect(down.pct).toBeCloseTo(0);
  });

  it('rare-level 레벨에 닿은 값은 그 레벨 p로 표시된다', () => {
    const four = [1, 2, 4, 8];
    const up = tailPercentile(four, rareLevelDisparity(four, 'UP', 2.5));
    expect(up.side).toBe('UP');
    expect(up.pct).toBeCloseTo(2.5);
    const down = tailPercentile(four, rareLevelDisparity(four, 'DOWN', 7.3));
    expect(down.side).toBe('DOWN');
    expect(down.pct).toBeCloseTo(7.3);
  });
});

describe('liveDisparity', () => {
  it('직전 유효 종가의 마지막 K−1개 + 오늘 가격으로 이평선을 만든다', () => {
    // 이평선 = (30 + 40 + 50) / 3 = 40 → (50 / 40 − 1) × 100 = 25
    expect(liveDisparity([10, 20, 30, 40], 50, 3)).toBeCloseTo(25);
  });

  it('직전 종가가 정확히 K−1개면 계산한다', () => {
    expect(liveDisparity([30, 40], 50, 3)).toBeCloseTo(25);
  });

  it('K=1이면 직전 종가 없이도 이격도 0', () => {
    expect(liveDisparity([], 50, 1)).toBeCloseTo(0);
  });

  it('직전 종가가 K−1개보다 적으면 null', () => {
    expect(liveDisparity([40], 50, 3)).toBeNull();
    expect(liveDisparity([], 50, 2)).toBeNull();
  });

  it('가격이 0 이하이면 null', () => {
    expect(liveDisparity([30, 40], 0, 3)).toBeNull();
    expect(liveDisparity([30, 40], -5, 3)).toBeNull();
  });

  it('이평선이 0 이하이면 null', () => {
    // 이평선 = (−100 − 100 + 10) / 3 < 0
    expect(liveDisparity([-100, -100], 10, 3)).toBeNull();
    // 이평선 = (−10 + 10) / 2 = 0
    expect(liveDisparity([-10], 10, 2)).toBeNull();
  });
});

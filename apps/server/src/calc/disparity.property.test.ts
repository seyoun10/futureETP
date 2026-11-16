// 속성 기반 테스트(D-129): 예시 테스트가 만들지 않는 입력에서도 백분위·이격도 정의가 지켜지는지 본다.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  buildDisparitySeries,
  liveDisparity,
  percentile,
  percentileRank,
  rareLevelDisparity,
  tailPercentile,
  type CloseBar,
} from './disparity.ts';

const ascending = (values: readonly number[]) => [...values].sort((a, b) => a - b);

// 이격도 범위의 값(소수 2자리). 같은 값이 섞이도록 정수에서 만든다
const disparityValue = fc.integer({ min: -5000, max: 5000 }).map((v) => v / 100);
const sortedSample = fc.array(disparityValue, { minLength: 1, maxLength: 60 }).map(ascending);
const distinctSorted = fc
  .uniqueArray(disparityValue, { minLength: 2, maxLength: 60 })
  .map(ascending);
const quantile = fc.double({ min: 0, max: 100, noNaN: true });
const positivePrice = fc.integer({ min: 1, max: 1_000_000 }).map((v) => v / 100);

describe('percentile 속성', () => {
  it('결과는 분포의 최솟값·최댓값 사이이고 0·100은 양 끝이다', () => {
    fc.assert(
      fc.property(sortedSample, quantile, (sorted, q) => {
        const v = percentile(sorted, q);
        expect(v).toBeGreaterThanOrEqual(sorted[0]!);
        expect(v).toBeLessThanOrEqual(sorted.at(-1)!);
        expect(percentile(sorted, 0)).toBe(sorted[0]);
        expect(percentile(sorted, 100)).toBe(sorted.at(-1));
      }),
    );
  });

  it('q에 대해 단조 증가한다', () => {
    fc.assert(
      fc.property(sortedSample, quantile, quantile, (sorted, a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(percentile(sorted, lo)).toBeLessThanOrEqual(percentile(sorted, hi) + 1e-9);
      }),
    );
  });
});

describe('percentileRank 속성', () => {
  it('결과는 0~100이고 x에 대해 단조 증가한다', () => {
    fc.assert(
      fc.property(sortedSample, disparityValue, disparityValue, (sorted, a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        const rLo = percentileRank(sorted, lo);
        const rHi = percentileRank(sorted, hi);
        for (const r of [rLo, rHi]) {
          expect(r).toBeGreaterThanOrEqual(0);
          expect(r).toBeLessThanOrEqual(100);
        }
        expect(rLo).toBeLessThanOrEqual(rHi + 1e-9);
      }),
    );
  });

  it('값이 모두 다르면 percentile의 역함수다', () => {
    fc.assert(
      fc.property(distinctSorted, quantile, (sorted, q) => {
        expect(percentileRank(sorted, percentile(sorted, q))).toBeCloseTo(q, 6);
      }),
    );
  });
});

describe('rare 레벨과 꼬리 백분위 속성', () => {
  // rare-level 선에 닿은 가격은 정확히 그 레벨로 표시된다(D-067)
  it('rare 레벨 이격도의 꼬리 백분위는 그 레벨·방향이다', () => {
    const level = fc.double({ min: 0.01, max: 49.99, noNaN: true });
    fc.assert(
      fc.property(
        distinctSorted,
        fc.constantFrom('UP', 'DOWN' as const),
        level,
        (sorted, dir, p) => {
          const tail = tailPercentile(sorted, rareLevelDisparity(sorted, dir, p));
          expect(tail.side).toBe(dir);
          expect(tail.pct).toBeCloseTo(p, 6);
        },
      ),
    );
  });
});

describe('buildDisparitySeries 속성', () => {
  const bars = fc.array(fc.option(positivePrice, { nil: null }), { maxLength: 80 }).map((closes) =>
    closes.map((close, i): CloseBar => ({
      tradeDate: `2020-01-01+${String(i).padStart(3, '0')}`,
      close,
    })),
  );
  const maPeriod = fc.integer({ min: 1, max: 30 });

  it('유효 종가마다 한 행이고, K번째 유효 종가부터 유한한 이평선·이격도가 있다', () => {
    fc.assert(
      fc.property(bars, maPeriod, (input, k) => {
        const rows = buildDisparitySeries(input, k);
        const valid = input.filter((b) => b.close !== null);
        expect(rows.map((r) => r.tradeDate)).toEqual(valid.map((b) => b.tradeDate));
        rows.forEach((row, i) => {
          if (i < k - 1) {
            expect(row).toMatchObject({ ma: null, disparity: null });
          } else {
            expect(Number.isFinite(row.ma)).toBe(true);
            expect(Number.isFinite(row.disparity)).toBe(true);
            expect(row.ma).toBeGreaterThan(0);
          }
        });
      }),
    );
  });

  it('행의 이격도는 직전 유효 종가로 계산한 잠정 이격도(liveDisparity)와 같다', () => {
    fc.assert(
      fc.property(bars, maPeriod, (input, k) => {
        const closes = input.flatMap((b) => (b.close === null ? [] : [b.close]));
        buildDisparitySeries(input, k).forEach((row, i) => {
          const live = liveDisparity(closes.slice(0, i), closes[i]!, k);
          if (row.disparity === null) expect(live).toBeNull();
          else expect(live).toBeCloseTo(row.disparity, 9);
        });
      }),
    );
  });
});

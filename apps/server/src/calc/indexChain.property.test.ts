// 속성 기반 테스트(D-129): 수익률 연결 지수가 전일 비중 기준 혼합 수익률을 그대로 이어 붙이는지 본다.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { buildIndexBars, indexScaleRatio, type IndexInputDay } from './indexChain.ts';

const SYMBOLS = ['CLF26', 'CLG26'] as const;
const price = fc.integer({ min: 1, max: 100_000 }).map((v) => v / 100);
// 첫 월물 비중(0~1, 둘째는 나머지)
const share = fc.integer({ min: 0, max: 10 }).map((v) => v / 10);

const daysOf = (priceArb: fc.Arbitrary<number>) =>
  fc
    .array(fc.record({ a: priceArb, b: priceArb, share }), { minLength: 1, maxLength: 40 })
    .map((raw) =>
      raw.map(({ a, b, share: s }, i): IndexInputDay => ({
        tradeDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
        bars: new Map([
          [SYMBOLS[0], { open: null, high: null, low: null, settle: a }],
          [SYMBOLS[1], { open: null, high: null, low: null, settle: b }],
        ]),
        weights: [
          { symbol: SYMBOLS[0], weight: s },
          { symbol: SYMBOLS[1], weight: 1 - s },
        ].filter((w) => w.weight > 0),
        inRollPeriod: false,
      })),
    );

const days = daysOf(price);
// 0 이하 정산가(2020-04 CL)가 섞여 산출 불가일이 생기는 입력
const daysWithInvalid = daysOf(
  fc.oneof(
    { arbitrary: price, weight: 4 },
    { arbitrary: fc.integer({ min: -5000, max: 0 }).map((v) => v / 100), weight: 1 },
  ),
);

const settle = (day: IndexInputDay, symbol: string) => day.bars.get(symbol)!.settle;
// 지수는 수백만까지 커질 수 있어 상대 오차로 비교한다
const expectRelClose = (actual: number, expected: number) =>
  expect(Math.abs(actual / expected - 1)).toBeLessThan(1e-9);

const blendAt = (weightsDay: IndexInputDay, priceDay: IndexInputDay) =>
  weightsDay.weights.reduce((sum, w) => sum + w.weight * settle(priceDay, w.symbol), 0);

describe('buildIndexBars 속성', () => {
  it('양수 가격이면 모든 날이 유효하고 지수는 유한한 양수다', () => {
    fc.assert(
      fc.property(days, (input) => {
        for (const row of buildIndexBars(input)) {
          expect(row.isValid).toBe(true);
          expect(Number.isFinite(row.close)).toBe(true);
          expect(row.close).toBeGreaterThan(0);
        }
      }),
    );
  });

  it('첫날 지수는 혼합 가격이고, 이후 일일 변화율은 전일 비중의 혼합 가격 변화율이다', () => {
    fc.assert(
      fc.property(days, (input) => {
        const rows = buildIndexBars(input);
        expectRelClose(rows[0]!.close!, blendAt(input[0]!, input[0]!));
        for (let i = 1; i < rows.length; i++) {
          const expected =
            blendAt(input[i - 1]!, input[i]!) / blendAt(input[i - 1]!, input[i - 1]!);
          expectRelClose(rows[i]!.close! / rows[i - 1]!.close!, expected);
        }
      }),
    );
  });

  it('모든 가격을 c배 하면 지수도 c배이고 맞춤 비율은 그대로다', () => {
    const scale = fc.integer({ min: 1, max: 1000 }).map((v) => v / 10);
    fc.assert(
      fc.property(days, scale, (input, c) => {
        const scaled = input.map((day) => ({
          ...day,
          bars: new Map([...day.bars].map(([s, bar]) => [s, { ...bar, settle: bar.settle * c }])),
        }));
        const base = buildIndexBars(input);
        const big = buildIndexBars(scaled);
        big.forEach((row, i) => {
          expectRelClose(row.close! / base[i]!.close!, c);
        });
        expectRelClose(indexScaleRatio(big)!, indexScaleRatio(base)!);
      }),
    );
  });

  it('산출 불가일은 건너뛰고, 다음 유효일은 직전 유효일에 전일 비중으로 이어 붙인다(D-004, D-066)', () => {
    fc.assert(
      fc.property(daysWithInvalid, (input) => {
        const rows = buildIndexBars(input);
        // 명세대로 직접 계산한 기대값: 직전 유효일 v가 있으면 close(v) × Σ w(t-1)·P(t) / blend(v)
        let anchor: { close: number; blend: number } | null = null;
        rows.forEach((row, t) => {
          const day = input[t]!;
          const blend = blendAt(day, day);
          const numerator = anchor
            ? (anchor.close * blendAt(input[t - 1]!, day)) / anchor.blend
            : blend;
          expect(row.blendedPrice).toBeCloseTo(blend, 9);
          expect(row.isValid).toBe(numerator > 0 && blend > 0);
          if (!row.isValid) {
            expect(row).toMatchObject({ open: null, high: null, low: null, close: null });
            return;
          }
          expectRelClose(row.close!, numerator);
          anchor = { close: row.close!, blend };
        });
      }),
    );
  });
});

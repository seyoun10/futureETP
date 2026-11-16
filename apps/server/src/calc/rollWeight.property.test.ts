// 속성 기반 테스트(D-129): 임의의 시작일·기간·휴장일에서도 롤 비중이 정의(D-013, D-065)를 지키는지 본다.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseContractSymbol } from './contractSymbol.ts';
import {
  expandRollWeights,
  NYSE_ONLY_CLOSED,
  ROLL_RULE_SEEDS,
  type DayPrices,
  type RollInputDay,
} from './rollWeight.ts';

const DAY_MS = 86_400_000;
const FROM = Date.UTC(2011, 0, 1);
const TO = Date.UTC(2030, 0, 1);
const toDay = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / DAY_MS;

// 시작일: 아무 날이나, 또는 NYSE만 쉰 날(GSCI 영업일 순번에서 빠짐, D-065) 직전 두 달 안
const start = fc.oneof(
  fc.integer({ min: FROM / DAY_MS, max: TO / DAY_MS }),
  fc
    .record({ closed: fc.constantFrom(...NYSE_ONLY_CLOSED), back: fc.integer({ min: 0, max: 60 }) })
    .map(({ closed, back }) => toDay(closed) - back),
);

// 시작일부터 length일 동안의 평일 중 skip에 걸린 날(휴장)을 뺀 거래일
const tradeDates = fc
  .record({
    start,
    length: fc.integer({ min: 1, max: 120 }),
    skip: fc.array(fc.integer({ min: 0, max: 119 }), { maxLength: 6 }),
  })
  .map(({ start: from, length, skip }) => {
    const out: string[] = [];
    for (let i = 0; i < length; i++) {
      const d = new Date((from + i) * DAY_MS);
      const dow = d.getUTCDay();
      if (dow !== 0 && dow !== 6 && !skip.includes(i)) out.push(d.toISOString().slice(0, 10));
    }
    return out;
  })
  .filter((dates) => dates.length > 0);

// 월물마다 정해지는 양수 가격(여러 leg 규칙의 수량 계산용). 날짜별 흔들림은 seed로 만든다
const pricesFor = (seed: number, tradeDate: string): DayPrices => {
  const get = (symbol: string) => {
    let h = seed;
    for (const ch of `${symbol}${tradeDate}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    return 10 + (h % 10_000) / 100;
  };
  return { get } as unknown as DayPrices;
};

const scenario = fc.record({
  rule: fc.constantFrom(...ROLL_RULE_SEEDS),
  dates: tradeDates,
  priceSeed: fc.nat(),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

const expand = ({ rule, dates, priceSeed }: Scenario) =>
  expandRollWeights(
    rule.commodityCode,
    rule.params,
    dates.map((tradeDate): RollInputDay => ({
      tradeDate,
      prices: pricesFor(priceSeed, tradeDate),
    })),
  );

describe('expandRollWeights 속성', () => {
  it('날마다 비중은 0 초과 1 이하, 합 1, 월물 오름차순이고 같은 월물은 한 번만 나온다', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const result = expand(s);
        expect(result.map((r) => r.tradeDate)).toEqual(s.dates);
        for (const { weights } of result) {
          const months = weights.map((w) => parseContractSymbol(w.symbol).contractMonth);
          expect(months).toEqual([...new Set(months)].sort());
          for (const { weight } of weights) {
            expect(weight).toBeGreaterThan(0);
            expect(weight).toBeLessThanOrEqual(1 + 1e-12);
          }
          expect(weights.reduce((sum, w) => sum + w.weight, 0)).toBeCloseTo(1, 12);
        }
      }),
    );
  });

  it('비중은 롤 기간인 날에만 바뀐다(월·연도 경계 포함)', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        const result = expand(s);
        for (let i = 1; i < result.length; i++) {
          const prev = result[i - 1]!;
          const cur = result[i]!;
          if (!cur.inRollPeriod) expect(cur.weights).toEqual(prev.weights);
        }
      }),
    );
  });

  it('NYSE만 쉰 날은 롤 기간이 아니다(GSCI)', () => {
    fc.assert(
      fc.property(scenario, (s) => {
        fc.pre(s.rule.params.calendar === 'NYSE');
        for (const row of expand(s)) {
          if (NYSE_ONLY_CLOSED.includes(row.tradeDate)) expect(row.inRollPeriod).toBe(false);
        }
      }),
    );
  });
});

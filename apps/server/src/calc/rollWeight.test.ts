// 명세(docs/decisions.md D-065·D-013, docs/research/roll-rules.md)만 보고 작성한 테스트(D-057).
import { describe, expect, it } from 'vitest';
import {
  businessDays,
  expandRollWeights,
  NYSE_ONLY_CLOSED,
  ROLL_RULE_SEEDS,
  rollRuleParamsSchema,
  type RollInputDay,
  type RollRuleParams,
  type RollWeightDay,
} from './rollWeight.ts';

// 시작~끝(포함) 평일 중 holidays를 뺀 거래일 목록
function weekdays(from: string, to: string, holidays: readonly string[] = []): string[] {
  const out: string[] = [];
  const end = new Date(`${to}T00:00:00Z`);
  for (let d = new Date(`${from}T00:00:00Z`); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const dow = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidays.includes(iso)) out.push(iso);
  }
  return out;
}

// 가격이 필요 없는(leg 하나) 규칙용 입력
const noPrices = (dates: readonly string[]): RollInputDay[] =>
  dates.map((tradeDate) => ({ tradeDate, prices: new Map() }));

const LINEAR = { rollDays: [5, 6, 7, 8, 9], oldShares: [0.8, 0.6, 0.4, 0.2, 0] } as const;

const GSCI_CL: RollRuleParams = {
  calendar: 'NYSE',
  ...LINEAR,
  rebalance: null,
  legs: [{ weight: 1, hold: ['G', 'H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z', 'F+1'] }],
};
const GC_HOLD = ['G', 'J', 'J', 'M', 'M', 'Q', 'Q', 'Z', 'Z', 'Z', 'Z', 'G+1'];
const GSCI_GC: RollRuleParams = {
  calendar: 'NYSE',
  ...LINEAR,
  rebalance: null,
  legs: [{ weight: 1, hold: GC_HOLD }],
};
const BCOM_GC: RollRuleParams = { ...GSCI_GC, calendar: 'BCOM' };
const BCOM_NG: RollRuleParams = {
  calendar: 'BCOM',
  ...LINEAR,
  rebalance: null,
  legs: [{ weight: 1, hold: ['H', 'H', 'K', 'K', 'N', 'N', 'U', 'U', 'X', 'X', 'F+1', 'F+1'] }],
};
const BCBCLI: RollRuleParams = {
  calendar: 'NYMEX',
  rollDays: [2, 3],
  oldShares: [0.5, 0],
  rebalance: { months: [3, 9], businessDay: 1 },
  legs: [
    { weight: 1 / 3, hold: ['H', 'J', 'K', 'M', 'N', 'Q', 'U', 'V', 'X', 'Z', 'F+1', 'G+1'] },
    { weight: 1 / 3, hold: ['M', 'M', 'M', ...Array<string>(9).fill('M+1')] },
    { weight: 1 / 3, hold: [...Array<string>(9).fill('Z'), 'Z+1', 'Z+1', 'Z+1'] },
  ],
};

const byDate = (result: RollWeightDay[]) => new Map(result.map((d) => [d.tradeDate, d]));

// 월물 순서(오름차순)와 비중을 함께 확인한다
function expectWeights(day: RollWeightDay | undefined, expected: [string, number][]) {
  expect(day).toBeDefined();
  expect(day!.weights.map((w) => w.symbol)).toEqual(expected.map(([s]) => s));
  day!.weights.forEach((w, i) => expect(w.weight).toBeCloseTo(expected[i][1], 10));
}

// 수량 → 합 1 비중
function normalized(q: [string, number][]): [string, number][] {
  const sum = q.reduce((a, [, v]) => a + v, 0);
  return q.map(([s, v]) => [s, v / sum]);
}

const rollDates = (result: RollWeightDay[]) =>
  result.filter((d) => d.inRollPeriod).map((d) => d.tradeDate);

describe('businessDays', () => {
  const dates = ['2018-12-04', '2018-12-05', '2018-12-06'];

  it('NYSE 달력은 NYSE만 쉰 날을 뺀다', () => {
    expect(businessDays('NYSE', dates)).toEqual(new Set(['2018-12-04', '2018-12-06']));
  });

  it('BCOM·NYMEX 달력은 거래일을 그대로 쓴다', () => {
    expect(businessDays('BCOM', dates)).toEqual(new Set(dates));
    expect(businessDays('NYMEX', dates)).toEqual(new Set(dates));
  });

  it('NYSE만 쉰 날 목록', () => {
    expect([...NYSE_ONLY_CLOSED].sort()).toEqual(['2012-10-29', '2012-10-30', '2018-12-05']);
  });
});

describe('expandRollWeights: leg 하나(GSCI·BCOM)', () => {
  it('GSCI CL 2026년 10월: 5~9영업일 종가에 X26 → Z26', () => {
    const result = expandRollWeights('CL', GSCI_CL, noPrices(weekdays('2026-10-01', '2026-10-30')));
    const d = byDate(result);
    for (const date of ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06']) {
      expectWeights(d.get(date), [['CLX26', 1]]);
    }
    expectWeights(d.get('2026-10-07'), [
      ['CLX26', 0.8],
      ['CLZ26', 0.2],
    ]);
    expectWeights(d.get('2026-10-08'), [
      ['CLX26', 0.6],
      ['CLZ26', 0.4],
    ]);
    expectWeights(d.get('2026-10-09'), [
      ['CLX26', 0.4],
      ['CLZ26', 0.6],
    ]);
    expectWeights(d.get('2026-10-12'), [
      ['CLX26', 0.2],
      ['CLZ26', 0.8],
    ]);
    // 비중 0인 월물은 뺀다
    expectWeights(d.get('2026-10-13'), [['CLZ26', 1]]);
    expectWeights(d.get('2026-10-30'), [['CLZ26', 1]]);
    expect(rollDates(result)).toEqual([
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-12',
      '2026-10-13',
    ]);
  });

  it('결과는 입력 거래일마다 하나씩이고 비중 합은 1이다', () => {
    const dates = weekdays('2026-10-01', '2026-10-30');
    const result = expandRollWeights('CL', GSCI_CL, noPrices(dates));
    expect(result.map((r) => r.tradeDate)).toEqual(dates);
    for (const day of result) {
      expect(day.weights.reduce((a, w) => a + w.weight, 0)).toBeCloseTo(1, 10);
    }
  });

  it('GSCI GC 롤 없는 달(2027년 2월 J → 3월 J)은 롤 구간이 없다', () => {
    const result = expandRollWeights(
      'GC',
      GSCI_GC,
      noPrices(weekdays('2027-02-01', '2027-02-26', ['2027-02-15'])),
    );
    expect(rollDates(result)).toEqual([]);
    for (const day of result) expectWeights(day, [['GCJ27', 1]]);
  });

  it('GSCI GC 롤 하는 달(2027년 1월 G → J)', () => {
    const result = expandRollWeights(
      'GC',
      GSCI_GC,
      // 1/1(평일 휴장)이 적재 첫 달 규칙에 걸리지 않게 전년 12월부터 넣는다
      noPrices(weekdays('2026-12-28', '2027-01-29', ['2027-01-01', '2027-01-18'])),
    );
    const d = byDate(result);
    expectWeights(d.get('2027-01-07'), [['GCG27', 1]]);
    expectWeights(d.get('2027-01-08'), [
      ['GCG27', 0.8],
      ['GCJ27', 0.2],
    ]);
    expectWeights(d.get('2027-01-14'), [['GCJ27', 1]]);
    expect(rollDates(result)).toEqual([
      '2027-01-08',
      '2027-01-11',
      '2027-01-12',
      '2027-01-13',
      '2027-01-14',
    ]);
  });

  it('12월은 다음 해 월물로 넘어간다(GSCI CL 2026년 12월 F27 → G27)', () => {
    const result = expandRollWeights(
      'CL',
      GSCI_CL,
      noPrices(weekdays('2026-12-01', '2026-12-31', ['2026-12-25'])),
    );
    const d = byDate(result);
    expectWeights(d.get('2026-12-04'), [['CLF27', 1]]);
    expectWeights(d.get('2026-12-07'), [
      ['CLF27', 0.8],
      ['CLG27', 0.2],
    ]);
    expectWeights(d.get('2026-12-11'), [['CLG27', 1]]);
    expectWeights(d.get('2026-12-31'), [['CLG27', 1]]);
  });

  it('2025-01-09(NYSE만 휴장)는 GSCI·BCOM 모두 영업일로 센다(D-089)', () => {
    // 2025-01: 1/1·1/20 휴장. 5영업일 = 1/8, 9영업일 = 1/14
    const dates = weekdays('2024-12-30', '2025-01-31', ['2025-01-01', '2025-01-20']);
    for (const params of [GSCI_GC, BCOM_GC]) {
      const d = byDate(expandRollWeights('GC', params, noPrices(dates)));
      expectWeights(d.get('2025-01-08'), [
        ['GCG25', 0.8],
        ['GCJ25', 0.2],
      ]);
      expectWeights(d.get('2025-01-09'), [
        ['GCG25', 0.6],
        ['GCJ25', 0.4],
      ]);
      expectWeights(d.get('2025-01-14'), [['GCJ25', 1]]);
      expect(d.get('2025-01-15')!.inRollPeriod).toBe(false);
    }
  });

  it('NYSE만 쉰 날(2018-12-05)이 롤 구간 앞에 있으면 GSCI 5영업일이 하루 밀린다', () => {
    const dates = weekdays('2018-12-03', '2018-12-31', ['2018-12-25']);
    const gsci = byDate(expandRollWeights('CL', GSCI_CL, noPrices(dates)));
    expectWeights(gsci.get('2018-12-05'), [['CLF19', 1]]);
    expectWeights(gsci.get('2018-12-07'), [['CLF19', 1]]);
    expectWeights(gsci.get('2018-12-10'), [
      ['CLF19', 0.8],
      ['CLG19', 0.2],
    ]);
    expectWeights(gsci.get('2018-12-14'), [['CLG19', 1]]);

    const nymexRule: RollRuleParams = { ...GSCI_CL, calendar: 'NYMEX' };
    const nymex = byDate(expandRollWeights('CL', nymexRule, noPrices(dates)));
    expectWeights(nymex.get('2018-12-07'), [
      ['CLF19', 0.8],
      ['CLG19', 0.2],
    ]);
    expectWeights(nymex.get('2018-12-13'), [['CLG19', 1]]);
  });

  it('적재 첫 달: 첫 거래일 앞 같은 달 평일을 영업일로 센다(2010-06-07 = 5영업일)', () => {
    const result = expandRollWeights('CL', GSCI_CL, noPrices(weekdays('2010-06-07', '2010-06-30')));
    const d = byDate(result);
    expect(result[0].tradeDate).toBe('2010-06-07');
    expectWeights(d.get('2010-06-07'), [
      ['CLN10', 0.8],
      ['CLQ10', 0.2],
    ]);
    expect(d.get('2010-06-07')!.inRollPeriod).toBe(true);
    expectWeights(d.get('2010-06-11'), [['CLQ10', 1]]);
    expect(d.get('2010-06-14')!.inRollPeriod).toBe(false);
  });

  it('BCOM NG는 짝수 달에만 롤 한다', () => {
    const holidays2027 = [
      '2027-01-01',
      '2027-01-18',
      '2027-02-15',
      '2027-03-26',
      '2027-05-31',
      '2027-06-18',
      '2027-07-05',
      '2027-09-06',
      '2027-11-25',
      '2027-12-24',
    ];
    const result = expandRollWeights(
      'NG',
      BCOM_NG,
      noPrices(weekdays('2027-01-04', '2027-12-31', holidays2027)),
    );
    const months = new Set(rollDates(result).map((date) => Number(date.slice(5, 7))));
    expect([...months]).toEqual([2, 4, 6, 8, 10, 12]);
    const d = byDate(result);
    expectWeights(d.get('2027-01-29'), [['NGH27', 1]]);
    expectWeights(d.get('2027-02-05'), [
      ['NGH27', 0.8],
      ['NGK27', 0.2],
    ]);
    expectWeights(d.get('2027-02-11'), [['NGK27', 1]]);
    expectWeights(d.get('2027-12-31'), [['NGH28', 1]]);
  });
});

describe('expandRollWeights: BCBCLI(여러 leg, 수량)', () => {
  // 2027-02-24 시작(2월 롤은 이미 끝남) → 3월 재조정 → 4월 월간 롤
  const dates = weekdays('2027-02-24', '2027-04-07', ['2027-03-26']);
  const FIRST_PRICES = { CLK27: 50, CLM27: 40, CLZ27: 25 };
  const REBAL_PRICES = { CLK27: 49, CLM27: 48, CLM28: 36, CLZ27: 30 };
  const input = (first = FIRST_PRICES, rebal: Record<string, number> = REBAL_PRICES) =>
    dates.map((tradeDate) => ({
      tradeDate,
      prices: new Map(
        Object.entries(
          tradeDate === '2027-02-24' ? first : tradeDate === '2027-03-01' ? rebal : {},
        ),
      ),
    }));

  // 첫날 수량 = (1/3) / 가격. 300배 하면 K 2, M27 2.5, Z27 4
  const qOld = { K: 2, M27: 2.5, Z: 4 };
  // 3월 1영업일 V = Σ qOld × P(다음 월물) = 2×48 + 2.5×36 + 4×30 = 306
  const V = qOld.K * 48 + qOld.M27 * 36 + qOld.Z * 30;
  const qNew = { monthly: V / 3 / 48, june: V / 3 / 36, dec: V / 3 / 30 };

  const initial = normalized([
    ['CLK27', qOld.K],
    ['CLM27', qOld.M27],
    ['CLZ27', qOld.Z],
  ]);
  const afterMarchRoll = normalized([
    ['CLM27', qNew.monthly],
    ['CLZ27', qNew.dec],
    ['CLM28', qNew.june],
  ]);

  it('첫날 수량은 leg 가치가 1/3씩이 되게 정하고 롤 전까지 유지한다', () => {
    expect(V).toBe(306);
    const d = byDate(expandRollWeights('CL', BCBCLI, input()));
    for (const date of ['2027-02-24', '2027-02-26', '2027-03-01']) {
      expectWeights(d.get(date), initial);
      expect(d.get(date)!.inRollPeriod).toBe(false);
    }
  });

  it('재조정 달 2영업일: 이전 수량 절반 + 새 수량 절반, 같은 월물은 합친다', () => {
    const d = byDate(expandRollWeights('CL', BCBCLI, input()));
    expectWeights(
      d.get('2027-03-02'),
      normalized([
        ['CLK27', 0.5 * qOld.K],
        // 6월물 leg의 이전 월물 + 월간 leg의 다음 월물
        ['CLM27', 0.5 * qOld.M27 + 0.5 * qNew.monthly],
        // 12월물 leg는 Z27 → Z27로 수량만 옮긴다
        ['CLZ27', 0.5 * qOld.Z + 0.5 * qNew.dec],
        ['CLM28', 0.5 * qNew.june],
      ]),
    );
  });

  it('재조정 달 3영업일 뒤로는 새 수량만 담고 가격이 바뀌어도 수량 비중을 유지한다', () => {
    const result = expandRollWeights('CL', BCBCLI, input());
    const d = byDate(result);
    for (const date of ['2027-03-03', '2027-03-15', '2027-03-31', '2027-04-01']) {
      expectWeights(d.get(date), afterMarchRoll);
    }
    for (const day of result) {
      expect(day.weights.reduce((a, w) => a + w.weight, 0)).toBeCloseTo(1, 10);
    }
  });

  it('재조정이 아닌 달(4월)은 월간 leg만 M27 → N27로 롤 하고 수량은 그대로다', () => {
    const result = expandRollWeights('CL', BCBCLI, input());
    const d = byDate(result);
    expectWeights(
      d.get('2027-04-02'),
      normalized([
        ['CLM27', 0.5 * qNew.monthly],
        ['CLN27', 0.5 * qNew.monthly],
        ['CLZ27', qNew.dec],
        ['CLM28', qNew.june],
      ]),
    );
    expectWeights(
      d.get('2027-04-05'),
      normalized([
        ['CLN27', qNew.monthly],
        ['CLZ27', qNew.dec],
        ['CLM28', qNew.june],
      ]),
    );
    expect(rollDates(result)).toEqual(['2027-03-02', '2027-03-03', '2027-04-02', '2027-04-05']);
  });

  it('첫날 필요한 가격이 없으면 오류를 던진다', () => {
    expect(() =>
      expandRollWeights('CL', BCBCLI, input({ CLK27: 50, CLM27: 40 } as typeof FIRST_PRICES)),
    ).toThrow();
  });

  it('재조정일에 다음 월물 가격이 없으면 오류를 던진다', () => {
    expect(() =>
      expandRollWeights('CL', BCBCLI, input(FIRST_PRICES, { CLM27: 48, CLZ27: 30 })),
    ).toThrow();
  });
});

describe('rollRuleParamsSchema', () => {
  it('ROLL_RULE_SEEDS의 params를 모두 통과시킨다', () => {
    for (const seed of ROLL_RULE_SEEDS) {
      expect(rollRuleParamsSchema.safeParse(seed.params).success).toBe(true);
    }
    expect(rollRuleParamsSchema.safeParse(BCBCLI).success).toBe(true);
  });

  it('hold가 12칸이 아니면 거부한다', () => {
    const bad = { ...GSCI_GC, legs: [{ weight: 1, hold: GC_HOLD.slice(0, 11) }] };
    expect(rollRuleParamsSchema.safeParse(bad).success).toBe(false);
  });

  it('rollDays와 oldShares 길이가 다르면 거부한다', () => {
    const bad = { ...GSCI_GC, rollDays: [5, 6], oldShares: [0.8] };
    expect(rollRuleParamsSchema.safeParse(bad).success).toBe(false);
  });

  it.each([
    ['이전 월물 비중이 늘어나면', { rollDays: [5, 6, 7], oldShares: [0.5, 0.7, 0] }],
    ['마지막 비중이 0이 아니면', { rollDays: [5, 6], oldShares: [0.5, 0.2] }],
    ['재조정일이 첫 롤 영업일보다 앞이 아니면', { rebalance: { months: [3], businessDay: 5 } }],
  ])('%s 거부한다', (_, over) => {
    expect(rollRuleParamsSchema.safeParse({ ...GSCI_GC, ...over }).success).toBe(false);
  });
});

describe('ROLL_RULE_SEEDS', () => {
  const seed = (code: string, basis: 'KR' | 'US') => {
    const found = ROLL_RULE_SEEDS.find((s) => s.commodityCode === code && s.basis === basis);
    expect(found).toBeDefined();
    return found!;
  };

  it('원자재 4 × KR·US 8행이고 한국형은 모두 GSCI(NYSE, 5~9영업일)다', () => {
    expect(ROLL_RULE_SEEDS).toHaveLength(8);
    for (const code of ['GC', 'SI', 'CL', 'NG']) {
      const kr = seed(code, 'KR');
      expect(kr.ruleId).toBe('GSCI');
      expect(kr.params.calendar).toBe('NYSE');
      expect(kr.params.rollDays).toEqual([5, 6, 7, 8, 9]);
      expect(kr.params.oldShares).toEqual([0.8, 0.6, 0.4, 0.2, 0]);
      expect(kr.params.rebalance).toBeNull();
    }
  });

  it('보유 월물 일정이 리서치 표와 같다', () => {
    expect(seed('GC', 'KR').params.legs[0].hold).toEqual(GC_HOLD);
    expect(seed('GC', 'US').params.legs[0].hold).toEqual(GC_HOLD);
    expect(seed('SI', 'US').params.legs[0].hold).toEqual(seed('SI', 'KR').params.legs[0].hold);
    expect(seed('CL', 'KR').params.legs[0].hold).toEqual(GSCI_CL.legs[0].hold);
    expect(seed('NG', 'US').params.legs[0].hold).toEqual(BCOM_NG.legs[0].hold);
  });

  it('미국형은 CL만 BCBCLI(3 leg, NYMEX, 3·9월 재조정)이고 나머지는 BCOM이다', () => {
    const cl = seed('CL', 'US');
    expect(cl.ruleId).toBe('BCBCLI');
    expect(cl.params.calendar).toBe('NYMEX');
    expect(cl.params.legs).toHaveLength(3);
    expect(cl.params.rollDays).toEqual([2, 3]);
    expect(cl.params.oldShares).toEqual([0.5, 0]);
    expect(cl.params.rebalance).toEqual({ months: [3, 9], businessDay: 1 });
    expect(cl.params.legs.map((l) => l.hold)).toEqual(BCBCLI.legs.map((l) => l.hold));
    for (const code of ['GC', 'SI', 'NG']) {
      expect(seed(code, 'US').ruleId).toBe('BCOM');
      expect(seed(code, 'US').params.calendar).toBe('BCOM');
    }
  });
});

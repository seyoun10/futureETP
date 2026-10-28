// 한국형·미국형 롤 규칙(roll_rule.params)을 날짜별 월물 비중(roll_weight)으로 펼친다
// (product.md 한국형/미국형, research/roll-rules.md, D-013, D-065).
import { z } from 'zod';
import type { CommodityCode } from '@futureetp/shared';
import { MONTH_CODES, parseContractSymbol, toContractSymbol } from './contractSymbol.ts';

export const BUSINESS_CALENDARS = ['NYSE', 'BCOM', 'NYMEX'] as const;
export type BusinessCalendar = (typeof BUSINESS_CALENDARS)[number];

// 매월 1영업일 보유 월물: 월 코드 + 다음 해면 '+1'. 예: 'G', 'G+1'
export type HeldMonth = string;

export type RollLeg = {
  // 가치 비중(재조정 때 맞추는 값)
  weight: number;
  // 12칸, hold[0] = 1월
  hold: readonly HeldMonth[];
};

export type RollRuleParams = {
  calendar: BusinessCalendar;
  // 롤 영업일 순번과 그날 종가 뒤 이전 월물 비중
  rollDays: readonly number[];
  oldShares: readonly number[];
  rebalance: { months: readonly number[]; businessDay: number } | null;
  legs: readonly RollLeg[];
};

const HELD_MONTH = new RegExp(`^[${MONTH_CODES.join('')}](\\+1)?$`);
const month = z.number().int().min(1).max(12);

export const rollRuleParamsSchema = z
  .object({
    calendar: z.enum(BUSINESS_CALENDARS),
    rollDays: z.array(z.number().int().positive()).min(1),
    oldShares: z.array(z.number().min(0).max(1)).min(1),
    rebalance: z
      .object({ months: z.array(month).min(1), businessDay: z.number().int().positive() })
      .nullable(),
    legs: z
      .array(
        z.object({
          weight: z.number().positive(),
          hold: z.array(z.string().regex(HELD_MONTH)).length(12),
        }),
      )
      .min(1),
  })
  .refine((p) => p.rollDays.length === p.oldShares.length, '롤 영업일과 비중 개수가 다르다')
  .refine(
    (p) => p.rollDays.every((d, i) => i === 0 || d > p.rollDays[i - 1]),
    '롤 영업일은 오름차순이다',
  )
  .refine(
    (p) => p.oldShares.every((s, i) => i === 0 || s <= p.oldShares[i - 1]),
    '이전 월물 비중은 줄어들기만 한다',
  )
  .refine(
    (p) => p.oldShares[p.oldShares.length - 1] === 0,
    '마지막 롤 영업일에 이전 월물 비중은 0이다',
  )
  .refine(
    (p) => p.rebalance === null || p.rebalance.businessDay < p.rollDays[0],
    '재조정일은 첫 롤 영업일보다 앞이다',
  );

export type RollRuleSeed = {
  commodityCode: CommodityCode;
  basis: 'KR' | 'US';
  ruleId: 'GSCI' | 'BCOM' | 'BCBCLI';
  params: RollRuleParams;
};

const hold = (months: string) => months.split(' ');

const GSCI_ROLL = { rollDays: [5, 6, 7, 8, 9], oldShares: [0.8, 0.6, 0.4, 0.2, 0] };

const gsci = (holdMonths: string): RollRuleParams => ({
  calendar: 'NYSE',
  ...GSCI_ROLL,
  rebalance: null,
  legs: [{ weight: 1, hold: hold(holdMonths) }],
});

// BCOM은 6~10영업일이지만 서비스 공식에 맞추면 비중이 바뀌는 날이 GSCI와 같다(roll-rules.md 비중 시점)
const bcom = (holdMonths: string): RollRuleParams => ({
  calendar: 'BCOM',
  ...GSCI_ROLL,
  rebalance: null,
  legs: [{ weight: 1, hold: hold(holdMonths) }],
});

const GSCI_MONTHLY = 'G H J K M N Q U V X Z F+1';
const GC_METALS = 'G J J M M Q Q Z Z Z Z G+1';
const SI_METALS = 'H H K K N N U U Z Z Z H+1';

const BCBCLI: RollRuleParams = {
  calendar: 'NYMEX',
  rollDays: [2, 3],
  oldShares: [0.5, 0],
  rebalance: { months: [3, 9], businessDay: 1 },
  legs: [
    { weight: 1 / 3, hold: hold('H J K M N Q U V X Z F+1 G+1') },
    { weight: 1 / 3, hold: hold('M M M M+1 M+1 M+1 M+1 M+1 M+1 M+1 M+1 M+1') },
    { weight: 1 / 3, hold: hold('Z Z Z Z Z Z Z Z Z Z+1 Z+1 Z+1') },
  ],
};

// roll_rule 초기 행(D-013). 한국형은 모두 S&P GSCI, 미국형은 CL BCBCLI·나머지 BCOM
export const ROLL_RULE_SEEDS: readonly RollRuleSeed[] = [
  { commodityCode: 'GC', basis: 'KR', ruleId: 'GSCI', params: gsci(GC_METALS) },
  { commodityCode: 'GC', basis: 'US', ruleId: 'BCOM', params: bcom(GC_METALS) },
  { commodityCode: 'SI', basis: 'KR', ruleId: 'GSCI', params: gsci(SI_METALS) },
  { commodityCode: 'SI', basis: 'US', ruleId: 'BCOM', params: bcom(SI_METALS) },
  { commodityCode: 'CL', basis: 'KR', ruleId: 'GSCI', params: gsci(GSCI_MONTHLY) },
  { commodityCode: 'CL', basis: 'US', ruleId: 'BCBCLI', params: BCBCLI },
  { commodityCode: 'NG', basis: 'KR', ruleId: 'GSCI', params: gsci(GSCI_MONTHLY) },
  { commodityCode: 'NG', basis: 'US', ruleId: 'BCOM', params: bcom('H H K K N N U U X X F+1 F+1') },
];

// CME는 열렸어도 NYSE가 쉬고 S&P가 GSCI를 계산하지 않은 날. GSCI 영업일 순번에서 뺀다.
// 2025-01-09(NYSE만 휴장)는 S&P가 계산·롤해서 넣지 않는다(D-089 재검증)
export const NYSE_ONLY_CLOSED: readonly string[] = ['2012-10-29', '2012-10-30', '2018-12-05'];

// 거래일(trading_day) 중 그 달력의 영업일. BCOM·NYMEX는 CME 거래일과 같게 본다
export function businessDays(
  calendar: BusinessCalendar,
  tradeDates: readonly string[],
): Set<string> {
  if (calendar !== 'NYSE') return new Set(tradeDates);
  const closed = new Set(NYSE_ONLY_CLOSED);
  return new Set(tradeDates.filter((d) => !closed.has(d)));
}

// 월물별 그 거래일 정산가
export type DayPrices = ReadonlyMap<string, number>;

export type RollInputDay = { tradeDate: string; prices: DayPrices };

export type RollWeightDay = {
  tradeDate: string;
  // 그날 종가 뒤 보유 비중(다음 날 수익률에 쓰임). 0은 빼고 월물 오름차순, 합 1
  weights: { symbol: string; weight: number }[];
  inRollPeriod: boolean;
};

function heldSymbol(commodityCode: CommodityCode, held: HeldMonth, year: number): string {
  const code = held[0] as (typeof MONTH_CODES)[number];
  const y = year + (held.endsWith('+1') ? 1 : 0);
  const mm = String(MONTH_CODES.indexOf(code) + 1).padStart(2, '0');
  return toContractSymbol(commodityCode, `${y}-${mm}`);
}

// 입력 첫 거래일보다 앞선 같은 달 평일 수(적재 첫 달의 영업일 순번 보정)
function weekdaysBefore(date: string): number {
  let count = 0;
  for (let d = 1; d < Number(date.slice(8, 10)); d++) {
    const dow = new Date(`${date.slice(0, 8)}${String(d).padStart(2, '0')}T00:00:00Z`).getUTCDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function oldShareAt(params: RollRuleParams, businessDay: number): number {
  let share = 1;
  params.rollDays.forEach((d, i) => {
    if (d <= businessDay) share = params.oldShares[i];
  });
  return share;
}

function priceOf(day: RollInputDay, symbol: string): number {
  const price = day.prices.get(symbol);
  if (price === undefined) throw new Error(`${day.tradeDate} ${symbol} 정산가가 없다`);
  return price;
}

// 거래일(오름차순)마다 그날 종가 뒤 월물 비중을 낸다.
// leg 수량은 롤해도 유지하고, 재조정 달에는 재조정일 종가에 다음 월물 가격으로 새 수량을 정해
// 롤 기간에 옮긴다(BCBCLI CIM). leg가 하나면 수량이 정규화로 지워지므로 가격을 쓰지 않는다.
export function expandRollWeights(
  commodityCode: CommodityCode,
  params: RollRuleParams,
  days: readonly RollInputDay[],
): RollWeightDay[] {
  const bizDays = businessDays(
    params.calendar,
    days.map((d) => d.tradeDate),
  );
  const multiLeg = params.legs.length > 1;
  const result: RollWeightDay[] = [];

  let monthKey = '';
  let businessDay = 0;
  let qOld: number[] = [];
  let qNew: number[] = [];

  for (const day of days) {
    const year = Number(day.tradeDate.slice(0, 4));
    const mon = Number(day.tradeDate.slice(5, 7));
    const first = result.length === 0;

    if (day.tradeDate.slice(0, 7) !== monthKey) {
      monthKey = day.tradeDate.slice(0, 7);
      businessDay = first ? weekdaysBefore(day.tradeDate) : 0;
      // 지난달 롤이 끝났으므로 새 수량이 이전 월물 수량이 된다
      qOld = qNew;
      qNew = qOld;
    }
    const isBusinessDay = bizDays.has(day.tradeDate);
    if (isBusinessDay) businessDay++;

    const rebalanceMonth = params.rebalance?.months.includes(mon) ?? false;
    const legs = params.legs.map((leg) => {
      const lead = heldSymbol(commodityCode, leg.hold[mon - 1], year);
      const next = heldSymbol(commodityCode, leg.hold[mon % 12], mon === 12 ? year + 1 : year);
      return { lead, next, rolling: lead !== next || rebalanceMonth };
    });
    const share = oldShareAt(params, businessDay);
    const shareOf = (rolling: boolean) => (rolling ? share : 1);

    if (first) {
      // 첫날 종가 뒤 보유 기준 leg 가치가 weight 비율이 되게 한다
      qOld = params.legs.map((leg, i) => {
        if (!multiLeg) return 1;
        const { lead, next, rolling } = legs[i];
        const s = shareOf(rolling);
        // 비중이 0인 월물은 가격을 찾지 않는다(롤을 마친 날 이전 월물 등)
        const unit =
          (s > 0 ? s * priceOf(day, lead) : 0) + (s < 1 ? (1 - s) * priceOf(day, next) : 0);
        return leg.weight / unit;
      });
      qNew = qOld;
    }

    if (
      multiLeg &&
      rebalanceMonth &&
      isBusinessDay &&
      businessDay === params.rebalance?.businessDay
    ) {
      const value = legs.reduce((sum, l, i) => sum + qOld[i] * priceOf(day, l.next), 0);
      qNew = params.legs.map((leg, i) => (leg.weight * value) / priceOf(day, legs[i].next));
    }

    const bySymbol = new Map<string, number>();
    const add = (symbol: string, w: number) => {
      if (w > 0) bySymbol.set(symbol, (bySymbol.get(symbol) ?? 0) + w);
    };
    legs.forEach(({ lead, next, rolling }, i) => {
      const s = shareOf(rolling);
      add(lead, s * qOld[i]);
      add(next, (1 - s) * qNew[i]);
    });
    const total = [...bySymbol.values()].reduce((a, b) => a + b, 0);
    const weights = [...bySymbol]
      .map(([symbol, w]) => ({ symbol, weight: w / total }))
      .sort((a, b) =>
        parseContractSymbol(a.symbol).contractMonth.localeCompare(
          parseContractSymbol(b.symbol).contractMonth,
        ),
      );

    result.push({
      tradeDate: day.tradeDate,
      weights,
      inRollPeriod:
        isBusinessDay && legs.some((l) => l.rolling) && params.rollDays.includes(businessDay),
    });
  }
  return result;
}

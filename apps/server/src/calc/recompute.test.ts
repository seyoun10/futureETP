import { describe, expect, it } from 'vitest';
import { toContractSymbol } from './contractSymbol.ts';
import type { ListedContract } from './monthList.ts';
import { recomputeBasis, type RecomputeInput, type SourceBar } from './recompute.ts';
import { ROLL_RULE_SEEDS } from './rollWeight.ts';

const cl = (contractMonth: string, lastTradeDate: string): ListedContract => ({
  symbol: toContractSymbol('CL', contractMonth),
  contractMonth,
  lastTradeDate,
  isTarget: true,
});

const Z26 = cl('2026-12', '2026-11-19');
const F27 = cl('2027-01', '2026-12-17');

function bar(contractSymbol: string, tradeDate: string, settle: number, volume = 0): SourceBar {
  return { contractSymbol, tradeDate, open: null, high: null, low: null, settle, volume };
}

// from부터 평일 n개
function weekdays(from: string, n: number): string[] {
  const days: string[] = [];
  for (let d = new Date(`${from}T00:00:00Z`); days.length < n; d.setUTCDate(d.getUTCDate() + 1)) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) days.push(d.toISOString().slice(0, 10));
  }
  return days;
}

const input = (over: Partial<RecomputeInput>): RecomputeInput => ({
  commodityCode: 'CL',
  rule: null,
  contracts: [Z26, F27],
  tradeDates: [],
  bars: [],
  ...over,
});

describe('recomputeBasis: 대표월물', () => {
  const tradeDates = ['2026-10-30', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05'];
  const bars = [
    bar(Z26.symbol, '2026-11-02', 60, 100),
    bar(F27.symbol, '2026-11-02', 63, 50),
    bar(Z26.symbol, '2026-11-03', 61, 50),
    bar(F27.symbol, '2026-11-03', 65, 80),
    bar(Z26.symbol, '2026-11-04', 62, 10),
    bar(F27.symbol, '2026-11-04', 64, 90),
  ];
  const result = recomputeBasis(input({ tradeDates, bars }));

  it('행 t는 그날 종가 뒤 대표월물이고, 일봉 첫날~마지막 날만 쓴다', () => {
    expect(result.rollWeights).toEqual([
      { tradeDate: '2026-11-02', contractSymbol: Z26.symbol, weight: 1 },
      { tradeDate: '2026-11-03', contractSymbol: F27.symbol, weight: 1 },
      { tradeDate: '2026-11-04', contractSymbol: F27.symbol, weight: 1 },
    ]);
  });

  it('전환일(옛 대표월물의 마지막 날)을 롤 구간으로 둔다', () => {
    expect(result.indexBars.map((b) => b.inRollPeriod)).toEqual([false, true, false]);
  });

  it('지수는 전일 종가 뒤 월물의 수익률로 이어 붙이고, 맞춤 비율은 마지막 혼합 가격 / 지수', () => {
    expect(result.indexBars.map((b) => b.close)).toEqual([60, 61, (61 * 64) / 65]);
    expect(result.indexBars.map((b) => b.blendedPrice)).toEqual([60, 65, 64]);
    expect(result.scaleRatio).toBeCloseTo(65 / 61, 12);
  });

  it('이평선 4종 시계열을 내고, 표본이 없는 분포는 뺀다', () => {
    expect(result.disparities.map((d) => d.maPeriod)).toEqual([20, 50, 100, 200]);
    expect(result.disparities.every((d) => d.rows.length === 3)).toBe(true);
    expect(result.distributions).toEqual([]);
  });
});

describe('recomputeBasis: 이격도와 분포', () => {
  const tradeDates = weekdays('2026-10-01', 25);
  const bars = tradeDates.map((d, i) => bar(F27.symbol, d, 50 + i, 10));
  const result = recomputeBasis(input({ contracts: [F27], tradeDates, bars }));

  it('MA20은 20번째 유효일부터 이격도를 낸다', () => {
    const ma20 = result.disparities.find((d) => d.maPeriod === 20)!.rows;
    expect(ma20.slice(0, 19).every((r) => r.disparity === null)).toBe(true);
    // 50..69의 평균 59.5
    expect(ma20[19]).toMatchObject({ tradeDate: tradeDates[19], ma: 59.5 });
    expect(ma20[19].disparity).toBeCloseTo((69 / 59.5 - 1) * 100, 12);
  });

  it('분포는 마지막 거래일 기준, 표본이 있는 MA20만 N 4종', () => {
    expect(result.distributions.map((d) => [d.maPeriod, d.window])).toEqual([
      [20, 'Y3'],
      [20, 'Y5'],
      [20, 'Y10'],
      [20, 'ALL'],
    ]);
    expect(result.distributions[0]).toMatchObject({
      asOfTradeDate: tradeDates[24],
      actualStartDate: tradeDates[19],
      sampleCount: 6,
    });
  });
});

describe('recomputeBasis: 한국형(GSCI)', () => {
  const rule = ROLL_RULE_SEEDS.find((s) => s.commodityCode === 'CL' && s.basis === 'KR')!.params;
  // 2026-11 1~10영업일. 11월 보유 Z26, 다음 F27
  const tradeDates = weekdays('2026-11-02', 10);
  const bars = tradeDates.flatMap((d) => [bar(Z26.symbol, d, 60), bar(F27.symbol, d, 70)]);
  const result = recomputeBasis(input({ rule, tradeDates, bars }));

  it('5~9영업일에 이전 월물 비중을 0.2씩 옮기고 그날을 롤 구간으로 둔다', () => {
    const on = (date: string) => result.rollWeights.filter((w) => w.tradeDate === date);
    expect(on(tradeDates[3])).toEqual([
      { tradeDate: tradeDates[3], contractSymbol: Z26.symbol, weight: 1 },
    ]);
    expect(on(tradeDates[4]).map((w) => [w.contractSymbol, w.weight])).toEqual([
      [Z26.symbol, 0.8],
      [F27.symbol, expect.closeTo(0.2, 12)],
    ]);
    expect(on(tradeDates[9])).toEqual([
      { tradeDate: tradeDates[9], contractSymbol: F27.symbol, weight: 1 },
    ]);
    expect(result.indexBars.map((b) => b.inRollPeriod)).toEqual([
      false,
      false,
      false,
      false,
      true,
      true,
      true,
      true,
      true,
      false,
    ]);
  });

  it('가격이 그대로면 지수는 첫날 혼합 가격에 머물고, 맞춤 비율이 다음 월물 가격 수준으로 옮긴다', () => {
    expect(result.indexBars.every((b) => b.close !== null && Math.abs(b.close - 60) < 1e-9)).toBe(
      true,
    );
    expect(result.scaleRatio).toBeCloseTo(70 / 60, 12);
  });
});

describe('recomputeBasis: 입력 경계', () => {
  it('일봉이 없으면 빈 결과', () => {
    expect(recomputeBasis(input({ tradeDates: ['2026-11-02'] }))).toMatchObject({
      rollWeights: [],
      indexBars: [],
      scaleRatio: null,
      distributions: [],
    });
  });

  it('거래일이 아닌 날의 일봉은 오류', () => {
    expect(() =>
      recomputeBasis(
        input({ tradeDates: ['2026-11-02'], bars: [bar(Z26.symbol, '2026-11-01', 60, 1)] }),
      ),
    ).toThrow('2026-11-01 일봉이 있는데 거래일이 아니다');
  });

  it('구간 안 거래일에 보유 월물 일봉이 없으면 오류', () => {
    const tradeDates = ['2026-11-02', '2026-11-03', '2026-11-04'];
    const bars = [bar(Z26.symbol, '2026-11-02', 60, 1), bar(Z26.symbol, '2026-11-04', 61, 1)];
    expect(() => recomputeBasis(input({ tradeDates, bars }))).toThrow(
      `2026-11-03 ${Z26.symbol} 정산가가 없다`,
    );
  });
});

// 명세(product.md "계산 정의 > 커브", D-018·D-026, research/curve-settlement.md)만 보고 작성한 테스트(D-057).
import { describe, expect, it } from 'vitest';
import {
  CURVE_MAX_CONTRACTS,
  CURVE_MIN_AVG_VOLUME,
  CURVE_VOLUME_DAYS,
  averageVolume,
  compareCurves,
  curveSummary,
  selectCurve,
  volumeWindow,
  type CurveCandidate,
  type CurvePoint,
} from './curve.ts';
import { toContractSymbol } from './contractSymbol.ts';

type Code = Parameters<typeof toContractSymbol>[0];

function cand(
  code: Code,
  contractMonth: string,
  lastTradeDate: string,
  price: number | null,
  avgVolume: number,
  isTarget = true,
): CurveCandidate {
  return {
    symbol: toContractSymbol(code, contractMonth),
    contractMonth,
    lastTradeDate,
    isTarget,
    price,
    avgVolume,
  };
}

function point(
  code: Code,
  contractMonth: string,
  lastTradeDate: string,
  price: number,
  avgVolume = 1000,
): CurvePoint {
  return { ...cand(code, contractMonth, lastTradeDate, price, avgVolume), price };
}

// 2026-01-01부터 평일만 n개
function weekdays(n: number, start = '2026-01-01'): string[] {
  const out: string[] = [];
  const d = new Date(`${start}T00:00:00Z`);
  while (out.length < n) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

// YYYY-MM을 i개월 뒤로
function addMonths(contractMonth: string, i: number): string {
  const [y, m] = contractMonth.split('-').map(Number);
  const idx = y * 12 + (m - 1) + i;
  return `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}`;
}

// CL 월물 n개(시작 월물부터 매달), 최종 거래일은 인도월 전월 20일
function clSeries(startMonth: string, volumes: readonly number[]): CurveCandidate[] {
  return volumes.map((v, i) => {
    const month = addMonths(startMonth, i);
    const ltd = `${addMonths(month, -1)}-20`;
    return cand('CL', month, ltd, 70 + i, v);
  });
}

const symbols = (points: readonly { symbol: string }[]) => points.map((p) => p.symbol);

describe('상수', () => {
  it('기준값은 100계약, 20거래일, 24개다(D-018)', () => {
    expect(CURVE_MIN_AVG_VOLUME).toBe(100);
    expect(CURVE_VOLUME_DAYS).toBe(20);
    expect(CURVE_MAX_CONTRACTS).toBe(24);
  });
});

describe('volumeWindow', () => {
  const days = weekdays(30);

  it('정산이 있으면 커브 날짜를 포함한 마지막 20거래일이다', () => {
    const curveDate = days[24];
    const window = volumeWindow(days, curveDate, true);
    expect(window).toEqual(days.slice(5, 25));
    expect(window).toHaveLength(20);
    expect(window.at(-1)).toBe(curveDate);
  });

  it('정산이 없으면(장중) 커브 날짜를 빼고 전일까지 20거래일이다', () => {
    const curveDate = days[24];
    const window = volumeWindow(days, curveDate, false);
    expect(window).toEqual(days.slice(4, 24));
    expect(window).not.toContain(curveDate);
  });

  it('커브 날짜 뒤의 거래일은 넣지 않는다', () => {
    const window = volumeWindow(days, days[10], true);
    expect(window.every((d) => d <= days[10])).toBe(true);
  });

  it('커브 날짜까지 거래일이 20일보다 적으면 있는 날만 쓴다', () => {
    expect(volumeWindow(days, days[4], true)).toEqual(days.slice(0, 5));
    expect(volumeWindow(days, days[4], false)).toEqual(days.slice(0, 4));
  });

  it('첫 거래일에 정산이 없으면 빈 창이다', () => {
    expect(volumeWindow(days, days[0], false)).toEqual([]);
  });
});

describe('averageVolume', () => {
  const days = weekdays(5);

  it('창 안의 일봉 거래량을 평균한다', () => {
    const bars = days.map((tradeDate, i) => ({ tradeDate, volume: (i + 1) * 100 }));
    expect(averageVolume(bars, days)).toBeCloseTo(300);
  });

  it('창 밖의 일봉은 무시한다', () => {
    const bars = [
      { tradeDate: '2025-12-31', volume: 100000 },
      { tradeDate: days[0], volume: 100 },
      { tradeDate: days[1], volume: 300 },
    ];
    expect(averageVolume(bars, days.slice(0, 2))).toBeCloseTo(200);
  });

  it('상장 후 일수가 모자라면 일봉이 있는 날만으로 평균한다', () => {
    const bars = [
      { tradeDate: days[3], volume: 50 },
      { tradeDate: days[4], volume: 150 },
    ];
    expect(averageVolume(bars, days)).toBeCloseTo(100);
  });

  it('거래량 0인 날도 일봉이 있으면 평균에 넣는다', () => {
    const bars = [
      { tradeDate: days[0], volume: 0 },
      { tradeDate: days[1], volume: 200 },
    ];
    expect(averageVolume(bars, days)).toBeCloseTo(100);
  });

  it('창 안에 일봉이 없으면 0이다', () => {
    expect(averageVolume([{ tradeDate: '2025-12-31', volume: 500 }], days)).toBe(0);
    expect(averageVolume([], days)).toBe(0);
    expect(averageVolume([], [])).toBe(0);
  });
});

describe('selectCurve', () => {
  const curveDate = '2026-10-27';

  it('거래량이 충분하면 만기순으로 모두 넣고 M1·M2를 정한다', () => {
    const candidates = clSeries('2026-12', [5000, 3000, 2000, 1000]);
    const curve = selectCurve([...candidates].reverse(), curveDate, 'CLZ26');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27', 'CLG27', 'CLH27']);
    expect(curve.m1?.symbol).toBe('CLZ26');
    expect(curve.m2?.symbol).toBe('CLF27');
  });

  it('비대상 월물, 최종 거래일이 지난 월물, 가격이 없는 월물은 뺀다', () => {
    const candidates = [
      cand('GC', '2026-10', '2026-10-26', 2400, 5000), // 최종 거래일 경과
      cand('GC', '2026-11', '2026-11-25', 2410, 5000, false), // 비대상
      cand('GC', '2026-12', '2026-12-29', 2418, 5000),
      cand('GC', '2027-01', '2027-01-27', 2425, 5000, false), // 비대상
      cand('GC', '2027-02', '2027-02-24', null, 5000), // 가격 없음
      cand('GC', '2027-04', '2027-04-28', 2445, 5000),
    ];
    const curve = selectCurve(candidates, curveDate, 'GCZ26');
    expect(symbols(curve.contracts)).toEqual(['GCZ26', 'GCJ27']);
    expect(curve.m2?.symbol).toBe('GCJ27');
  });

  it('최종 거래일 당일인 월물은 넣는다', () => {
    const candidates = [
      cand('GC', '2026-10', curveDate, 2405, 30),
      cand('GC', '2026-12', '2026-12-29', 2418, 5000),
      cand('GC', '2027-02', '2027-02-24', 2431, 5000),
    ];
    const curve = selectCurve(candidates, curveDate, 'GCZ26');
    expect(symbols(curve.contracts)).toEqual(['GCV26', 'GCZ26', 'GCG27']);
  });

  it('M1보다 이른 월물은 거래량이 미달해도 넣는다(D-026)', () => {
    const candidates = clSeries('2026-12', [0, 10, 5000, 3000, 2000]);
    const curve = selectCurve(candidates, curveDate, 'CLG27');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27', 'CLG27', 'CLH27', 'CLJ27']);
    expect(curve.m1?.symbol).toBe('CLG27');
    expect(curve.m2?.symbol).toBe('CLH27');
  });

  it('M1은 거래량이 미달해도 넣는다', () => {
    const candidates = clSeries('2026-12', [50, 3000, 2000]);
    const curve = selectCurve(candidates, curveDate, 'CLZ26');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27', 'CLG27']);
  });

  it('M2가 미달이면 M2까지 넣고 멈춘다', () => {
    const candidates = clSeries('2026-12', [5000, 20, 3000, 2000]);
    const curve = selectCurve(candidates, curveDate, 'CLZ26');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27']);
    expect(curve.m2?.symbol).toBe('CLF27');
  });

  it('M3부터는 처음 미달한 월물을 빼고 멈춘다(뒤에 충분한 월물이 있어도)', () => {
    const candidates = clSeries('2026-12', [5000, 3000, 2000, 99, 5000, 5000]);
    const curve = selectCurve(candidates, curveDate, 'CLZ26');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27', 'CLG27']);
  });

  it('평균 거래량이 정확히 100이면 미달이 아니다', () => {
    const candidates = clSeries('2026-12', [5000, 3000, 100, 99.9]);
    const curve = selectCurve(candidates, curveDate, 'CLZ26');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27', 'CLG27']);
  });

  it('최대 24개이고 M1 앞 월물도 개수에 센다', () => {
    const candidates = clSeries(
      '2026-12',
      Array.from({ length: 30 }, (_, i) => (i < 2 ? 0 : 5000)),
    );
    const front = candidates[2].symbol;
    const curve = selectCurve(candidates, curveDate, front);
    expect(curve.contracts).toHaveLength(CURVE_MAX_CONTRACTS);
    expect(symbols(curve.contracts)).toEqual(symbols(candidates.slice(0, 24)));
    expect(curve.m1?.symbol).toBe(front);
  });

  it('최종 거래일이 같으면 계약월 순으로 놓는다', () => {
    const candidates = [
      cand('CL', '2027-01', '2026-11-19', 71, 5000),
      cand('CL', '2026-12', '2026-11-19', 70, 5000),
      cand('CL', '2027-02', '2026-12-17', 72, 5000),
    ];
    const curve = selectCurve(candidates, curveDate, 'CLZ26');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27', 'CLG27']);
    expect(curve.m2?.symbol).toBe('CLF27');
  });

  it('M1 뒤에 월물이 없으면 m2는 null이다', () => {
    const candidates = clSeries('2026-12', [0, 5000]);
    const curve = selectCurve(candidates, curveDate, 'CLF27');
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27']);
    expect(curve.m1?.symbol).toBe('CLF27');
    expect(curve.m2).toBeNull();
  });

  it('frontSymbol이 null이면 처음부터 거래량으로 판정하고 m1·m2는 null이다', () => {
    const candidates = clSeries('2026-12', [5000, 3000, 50, 5000]);
    const curve = selectCurve(candidates, curveDate, null);
    expect(symbols(curve.contracts)).toEqual(['CLZ26', 'CLF27']);
    expect(curve.m1).toBeNull();
    expect(curve.m2).toBeNull();
  });

  it('frontSymbol이 null이고 첫 월물이 미달이면 빈 커브다', () => {
    const candidates = clSeries('2026-12', [10, 5000, 5000]);
    const curve = selectCurve(candidates, curveDate, null);
    expect(curve.contracts).toEqual([]);
    expect(curve.m1).toBeNull();
    expect(curve.m2).toBeNull();
  });

  it('frontSymbol이 후보에 없으면(가격 없음 등) null과 같이 처리한다', () => {
    const candidates = [
      cand('CL', '2026-12', '2026-11-19', null, 5000),
      ...clSeries('2027-01', [10, 5000]),
    ];
    const curve = selectCurve(candidates, curveDate, 'CLZ26');
    expect(curve.contracts).toEqual([]);
    expect(curve.m1).toBeNull();
    expect(curve.m2).toBeNull();
  });

  it('후보가 없으면 빈 커브다', () => {
    expect(selectCurve([], curveDate, 'CLZ26')).toEqual({ contracts: [], m1: null, m2: null });
  });

  it('후보의 추가 필드를 그대로 유지한다', () => {
    const candidates = clSeries('2026-12', [5000, 3000]).map((c, i) => ({ ...c, id: i + 1 }));
    const curve = selectCurve(candidates, curveDate, 'CLZ26');
    expect(curve.contracts.map((c) => c.id)).toEqual([1, 2]);
    expect(curve.m1?.id).toBe(1);
    expect(curve.contracts[0].price).toBe(70);
  });
});

describe('compareCurves', () => {
  it('두 커브에 모두 있는 월물은 변화율을 계산한다', () => {
    const base = [point('NG', '2026-12', '2026-11-25', 3.152)];
    const current = [point('NG', '2026-12', '2026-11-25', 3.12)];
    const [row] = compareCurves(base, current);
    expect(row).toMatchObject({
      symbol: 'NGZ26',
      contractMonth: '2026-12',
      lastTradeDate: '2026-11-25',
      basePrice: 3.152,
      currentPrice: 3.12,
    });
    expect(row.changePct).toBeCloseTo((3.12 / 3.152 - 1) * 100);
    expect(row.changePct).toBeCloseTo(-1.015, 3);
  });

  it('기준일에만 있는 월물(그 사이 만기)은 현재 가격과 변화율이 null이다', () => {
    const base = [
      point('NG', '2026-11', '2026-10-28', 2.79),
      point('NG', '2026-12', '2026-11-25', 3.15),
    ];
    const current = [point('NG', '2026-12', '2026-11-25', 3.12)];
    const rows = compareCurves(base, current);
    expect(rows[0]).toEqual({
      symbol: 'NGX26',
      contractMonth: '2026-11',
      lastTradeDate: '2026-10-28',
      basePrice: 2.79,
      currentPrice: null,
      changePct: null,
    });
  });

  it('D에만 있는 월물(신규 상장)은 기준일 가격과 변화율이 null이다', () => {
    const base = [point('NG', '2026-12', '2026-11-25', 3.15)];
    const current = [
      point('NG', '2026-12', '2026-11-25', 3.12),
      point('NG', '2027-01', '2026-12-29', 3.402),
    ];
    const rows = compareCurves(base, current);
    expect(rows[1]).toEqual({
      symbol: 'NGF27',
      contractMonth: '2027-01',
      lastTradeDate: '2026-12-29',
      basePrice: null,
      currentPrice: 3.402,
      changePct: null,
    });
  });

  it('합친 결과는 만기순이다', () => {
    const base = [
      point('NG', '2027-01', '2026-12-29', 3.42),
      point('NG', '2026-11', '2026-10-28', 2.79),
    ];
    const current = [
      point('NG', '2027-02', '2027-01-27', 3.205),
      point('NG', '2026-12', '2026-11-25', 3.12),
      point('NG', '2027-01', '2026-12-29', 3.402),
    ];
    const rows = compareCurves(base, current);
    expect(symbols(rows)).toEqual(['NGX26', 'NGZ26', 'NGF27', 'NGG27']);
  });

  it('기준일 가격이 0 이하이면 변화율은 null이다', () => {
    const base = [
      point('CL', '2026-12', '2026-11-19', 0),
      point('CL', '2027-01', '2026-12-17', -5),
    ];
    const current = [
      point('CL', '2026-12', '2026-11-19', 70),
      point('CL', '2027-01', '2026-12-17', 71),
    ];
    const rows = compareCurves(base, current);
    expect(rows.map((r) => r.changePct)).toEqual([null, null]);
    expect(rows[0].basePrice).toBe(0);
    expect(rows[0].currentPrice).toBe(70);
  });

  it('두 커브가 비면 빈 배열이다', () => {
    expect(compareCurves([], [])).toEqual([]);
  });
});

describe('curveSummary', () => {
  // 와이어프레임 C-b: NG DEC26 3.120 → JAN27 3.402, 콘탱고 +9.0%, 롤 수익률 -89.0%/년
  const ngDec = point('NG', '2026-12', '2026-11-25', 3.12);
  const ngJan = point('NG', '2027-01', '2026-12-29', 3.402);

  it('와이어프레임 예시(NG DEC26→JAN27)는 콘탱고, 스프레드 +9.0%, 롤 수익률 -89.0%/년이다', () => {
    const summary = curveSummary(ngDec, ngJan);
    expect(summary).not.toBeNull();
    expect(summary?.state).toBe('CONTANGO');
    expect(summary?.daysBetween).toBe(34);
    expect(summary?.spreadPct).toBeCloseTo(9.0, 1);
    expect(summary?.spreadPct).toBeCloseTo((3.402 / 3.12 - 1) * 100);
    expect(summary?.rollYieldPct).toBeCloseTo(-89.0, 1);
    expect(summary?.rollYieldPct).toBeCloseTo((3.12 / 3.402 - 1) * (365 / 34) * 100);
  });

  it('M2가 M1보다 싸면 백워데이션이고 롤 수익률은 양수다', () => {
    const m1 = point('CL', '2026-12', '2026-11-19', 72);
    const m2 = point('CL', '2027-01', '2026-12-17', 71);
    const summary = curveSummary(m1, m2);
    expect(summary?.state).toBe('BACKWARDATION');
    expect(summary?.daysBetween).toBe(28);
    expect(summary?.spreadPct).toBeCloseTo((71 / 72 - 1) * 100);
    expect(summary?.rollYieldPct).toBeCloseTo((72 / 71 - 1) * (365 / 28) * 100);
    expect(summary?.rollYieldPct).toBeGreaterThan(0);
  });

  it('M1과 M2 가격이 같으면 FLAT이고 스프레드·롤 수익률은 0이다', () => {
    const m1 = point('CL', '2026-12', '2026-11-19', 70);
    const m2 = point('CL', '2027-01', '2026-12-17', 70);
    const summary = curveSummary(m1, m2);
    expect(summary?.state).toBe('FLAT');
    expect(summary?.spreadPct).toBeCloseTo(0);
    expect(summary?.rollYieldPct).toBeCloseTo(0);
  });

  it('만기 사이 일수는 달력 일수이고 연도·윤년을 넘어 센다', () => {
    const m1 = point('GC', '2027-12', '2027-12-29', 100);
    const m2 = point('GC', '2028-04', '2028-04-26', 101);
    // 2027-12-29 → 2028-04-26: 2 + 31 + 29 + 31 + 26 = 119일
    expect(curveSummary(m1, m2)?.daysBetween).toBe(119);
  });

  it('M1이나 M2가 없으면 null이다', () => {
    expect(curveSummary(null, ngJan)).toBeNull();
    expect(curveSummary(ngDec, null)).toBeNull();
    expect(curveSummary(null, null)).toBeNull();
  });

  it('가격이 0 이하이면 null이다', () => {
    expect(curveSummary({ ...ngDec, price: 0 }, ngJan)).toBeNull();
    expect(curveSummary(ngDec, { ...ngJan, price: 0 })).toBeNull();
    expect(curveSummary({ ...ngDec, price: -1 }, ngJan)).toBeNull();
  });

  it('두 최종 거래일 사이 일수가 0 이하이면 null이다', () => {
    expect(curveSummary(ngDec, { ...ngJan, lastTradeDate: ngDec.lastTradeDate })).toBeNull();
    expect(curveSummary(ngJan, ngDec)).toBeNull();
  });
});

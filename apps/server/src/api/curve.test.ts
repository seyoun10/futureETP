import { curveSchema } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import type { CurveBar } from '../calc/curve.ts';
import type { TradingDaySession } from '../calc/marketState.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import { createApp } from './app.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_DISPARITY,
  UNUSED_CONTRACTS,
  UNUSED_DEVICES,
  UNUSED_ETPS,
} from './commodities.fixtures.ts';
import type { CurveStore } from './curve.ts';

const TOKEN = 'test-token-0123456789abcdef0123456789';
const at = (iso: string) => new Date(iso);

// CDT(UTC-5): 세션은 전날 17:00 CT ~ 당일 16:00 CT
const session = (tradeDate: string, openUtc: string): TradingDaySession => ({
  tradeDate,
  sessionOpenAt: at(openUtc),
  sessionCloseAt: at(`${tradeDate}T21:00:00Z`),
  haltStartAt: null,
  haltEndAt: null,
});
// 10-19(월) ~ 10-23(금). 10-16(금)은 휴장
const DATES = ['2026-10-14', '2026-10-15', '2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'];
const SESSIONS = [
  session('2026-10-21', '2026-10-20T22:00:00Z'),
  session('2026-10-22', '2026-10-21T22:00:00Z'),
  session('2026-10-23', '2026-10-22T22:00:00Z'),
];
const CONTRACTS = [
  { symbol: 'CLZ26', contractMonth: '2026-12', lastTradeDate: '2026-11-20', isTarget: true },
  { symbol: 'CLF27', contractMonth: '2027-01', lastTradeDate: '2026-12-18', isTarget: true },
].map((c) => ({ ...c, firstBarDate: '2026-10-14' }));
const bar = (contractSymbol: string, tradeDate: string, settle: number): CurveBar => ({
  contractSymbol,
  tradeDate,
  settle,
  volume: 1000,
  collectedAt: at(`${tradeDate}T23:40:00Z`),
  revisedAt: null,
});
// D(10-22) 일봉은 정산된 경우에만 둔다
const barsUpTo = (last: string) =>
  DATES.filter((d) => d <= last).flatMap((d) => [bar('CLZ26', d, 70), bar('CLF27', d, 71)]);

type Calls = { tradeDates: [string, string][]; dailyBarDates: string[][]; snapshots: number };
type Data = {
  lastSettled?: string;
  firstBarDate?: string | null;
  withSnapshot?: boolean;
  // 거래일 목록을 바꿀 때(기본 DATES)
  dates?: string[];
  // store 호출 기록
  calls?: Calls;
};
const newCalls = (): Calls => ({ tradeDates: [], dailyBarDates: [], snapshots: 0 });

// DB 대신 메모리. 지금은 10-22 15:00Z = 10-22 장중이고 10-21까지 정산됐다.
function setup(path: string, data: Data = {}) {
  const lastSettled = data.lastSettled ?? '2026-10-21';
  const bars = barsUpTo(lastSettled);
  const dates = data.dates ?? DATES;
  const calls = data.calls ?? newCalls();
  const store: CurveStore = {
    tradingDays: (from, to) =>
      Promise.resolve(SESSIONS.filter((d) => d.tradeDate >= from && d.tradeDate <= to)),
    lastSettledTradeDate: () => Promise.resolve(lastSettled),
    latestSnapshots: () => {
      calls.snapshots += 1;
      return Promise.resolve(
        data.withSnapshot
          ? [
              { contractSymbol: 'CLZ26', capturedAt: at('2026-10-22T14:45:00Z'), last: 77 },
              { contractSymbol: 'CLF27', capturedAt: at('2026-10-22T14:30:00Z'), last: 71 },
            ]
          : [],
      );
    },
    priceDecimals: () => Promise.resolve(2),
    firstBarDate: () =>
      Promise.resolve(data.firstBarDate === undefined ? '2026-10-14' : data.firstBarDate),
    tradeDates: (from, to) => {
      calls.tradeDates.push([from, to]);
      return Promise.resolve(dates.filter((d) => d >= from && d <= to));
    },
    contracts: () => Promise.resolve(CONTRACTS),
    frontSymbol: () => Promise.resolve('CLZ26'),
    dailyBars: (symbols, barDates) => {
      calls.dailyBarDates.push(barDates);
      return Promise.resolve(
        bars.filter((b) => symbols.includes(b.contractSymbol) && barDates.includes(b.tradeDate)),
      );
    },
  };
  const app = createApp({
    token: TOKEN,
    checkDb: async () => {},
    settings: {
      get: () => Promise.reject(new Error('unused')),
      update: () => Promise.reject(new Error('unused')),
    },
    commodities: UNUSED_COMMODITIES,
    disparity: UNUSED_DISPARITY,
    curve: store,
    contracts: UNUSED_CONTRACTS,
    devices: UNUSED_DEVICES,
    etps: UNUSED_ETPS,
    now: () => at('2026-10-22T15:00:00Z').getTime(),
  });
  return app.request(path, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

const parse = async (res: Response) =>
  curveSchema.parse(((await res.json()) as { data: unknown }).data);

describe('GET /v1/commodities/:code/curve', () => {
  it('기준일이 없으면 D-1이고 D는 장중 스냅숏(지연)이다', async () => {
    const res = await setup('/v1/commodities/CL/curve', { withSnapshot: true });
    expect(res.status).toBe(200);
    const body = await parse(res);
    expect(body.freshness).toMatchObject({
      tradeDate: '2026-10-22',
      asOf: '2026-10-22T14:45:00.000Z',
      delayed: true,
      marketState: 'OPEN',
    });
    expect(body).toMatchObject({
      priceDecimals: 2,
      baseDate: '2026-10-21',
      baseOffset: 1,
      prevBaseDate: '2026-10-20',
      nextBaseDate: null,
      minBaseDate: '2026-10-14',
      maxBaseDate: '2026-10-21',
      compareDate: '2026-10-22',
    });
    expect(body.points).toEqual([
      expect.objectContaining({ symbol: 'CLZ26', basePrice: 70, currentPrice: 77 }),
      expect.objectContaining({ symbol: 'CLF27', basePrice: 71, currentPrice: 71 }),
    ]);
    expect(body.points[0]!.changePct).toBeCloseTo(10);
    expect(body.base).toMatchObject({ m1ContractMonth: '2026-12', state: 'CONTANGO' });
    expect(body.current).toMatchObject({ m2ContractMonth: '2027-01', state: 'BACKWARDATION' });
  });

  it('휴장일 기준일은 직전 거래일로 옮긴다', async () => {
    const body = await parse(await setup('/v1/commodities/CL/curve?baseDate=2026-10-16'));
    expect(body).toMatchObject({
      baseDate: '2026-10-15',
      baseOffset: 4,
      prevBaseDate: '2026-10-14',
      nextBaseDate: '2026-10-19',
      compareDate: '2026-10-19',
    });
  });

  it('지난 기준일은 다음 거래일 정산가와 비교하고 asOf는 조회 시각이다', async () => {
    const body = await parse(
      await setup('/v1/commodities/CL/curve?baseDate=2026-10-19', { withSnapshot: true }),
    );
    expect(body).toMatchObject({ baseDate: '2026-10-19', compareDate: '2026-10-20' });
    expect(body.freshness).toMatchObject({
      tradeDate: '2026-10-22',
      delayed: false,
      asOf: '2026-10-22T15:00:00.000Z',
    });
    // D 스냅숏(77)이 아니라 10-20 정산가
    expect(body.points.map((p) => [p.basePrice, p.currentPrice])).toEqual([
      [70, 70],
      [71, 71],
    ]);
  });

  it('D 정산가가 있으면 정산가를 쓴다', async () => {
    const res = await setup('/v1/commodities/CL/curve', { lastSettled: '2026-10-22' });
    const body = await parse(res);
    expect(body.freshness).toMatchObject({ delayed: false, asOf: '2026-10-22T23:40:00.000Z' });
    expect(body.points.map((p) => p.currentPrice)).toEqual([70, 71]);
  });

  it('D 값이 없으면 기준일 커브만 주고 asOf는 조회 시각이다', async () => {
    const body = await parse(await setup('/v1/commodities/CL/curve'));
    expect(body.freshness.asOf).toBe('2026-10-22T15:00:00.000Z');
    expect(body.points.every((p) => p.currentPrice === null)).toBe(true);
    expect(body.current).toBeNull();
  });

  it('일봉이 없으면 404 NOT_FOUND다', async () => {
    const res = await setup('/v1/commodities/CL/curve', { firstBarDate: null });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND', message: 'No daily bars for CL' },
    });
  });

  it('기준일로 고를 거래일이 없으면 404 NOT_FOUND다', async () => {
    // 첫 일봉이 D라 D-1 이전 기준일이 없다
    const res = await setup('/v1/commodities/CL/curve', { firstBarDate: '2026-10-22' });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({
      error: { code: 'NOT_FOUND', message: 'Not enough daily bars for CL' },
    });
  });

  it('거래일은 D 이전 기준일만 그 날짜부터, 아니면 D부터 45일 앞까지 읽는다', async () => {
    const read = async (query: string) => {
      const calls = newCalls();
      await setup(`/v1/commodities/CL/curve${query}`, { calls });
      return calls.tradeDates;
    };
    const fromD = [['2026-09-07', '2026-10-22']];
    expect(await read('?baseDate=2026-10-15')).toEqual([['2026-08-31', '2026-10-22']]);
    expect(await read('')).toEqual(fromD);
    expect(await read('?baseDate=2026-10-22')).toEqual(fromD);
    expect(await read('?baseDate=2026-10-30')).toEqual(fromD);
  });

  it('일봉은 기준일·비교일과 각자 그 전 20거래일만 읽는다', async () => {
    // 09-01 ~ 10-22 평일 37일(10-16 휴장 제외)
    const dates = Array.from({ length: 52 }, (_, i) => addDays('2026-09-01', i)).filter(
      (d) => ![0, 6].includes(new Date(`${d}T00:00:00Z`).getUTCDay()) && d !== '2026-10-16',
    );
    const calls = newCalls();
    await setup('/v1/commodities/CL/curve?baseDate=2026-10-15', { dates, calls });
    // 기준일 10-15 창 21일 ∪ 비교일 10-19 창 21일
    const end = dates.indexOf('2026-10-19');
    expect(calls.dailyBarDates).toEqual([dates.slice(end - 21, end + 1)]);
    expect(calls.dailyBarDates[0]![0]).toBe('2026-09-17');
  });

  it('비교일이 정산됐으면 스냅숏을 읽지 않는다', async () => {
    const snapshotReads = async (lastSettled: string, query = '') => {
      const calls = newCalls();
      await setup(`/v1/commodities/CL/curve${query}`, { lastSettled, calls });
      return calls.snapshots;
    };
    // 비교일 D(10-22): 정산 전이면 읽고, 정산됐으면 읽지 않는다
    expect(await snapshotReads('2026-10-21')).toBe(1);
    expect(await snapshotReads('2026-10-22')).toBe(0);
    // 지난 비교일(10-20)은 그보다 뒤까지 정산됐으니 읽지 않는다
    expect(await snapshotReads('2026-10-21', '?baseDate=2026-10-19')).toBe(0);
  });

  it('모르는 원자재는 404, 잘못된 기준일은 400 VALIDATION_FAILED다', async () => {
    expect((await setup('/v1/commodities/XX/curve')).status).toBe(404);
    const res = await setup('/v1/commodities/CL/curve?baseDate=2026-13-01');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });
});

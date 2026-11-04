import { curveSchema } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import type { CurveBar } from '../calc/curve.ts';
import type { TradingDaySession } from '../calc/marketState.ts';
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
];
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

type Data = { lastSettled?: string; firstBarDate?: string | null; withSnapshot?: boolean };

// DB 대신 메모리. 지금은 10-22 15:00Z = 10-22 장중이고 10-21까지 정산됐다.
function setup(path: string, data: Data = {}) {
  const lastSettled = data.lastSettled ?? '2026-10-21';
  const bars = barsUpTo(lastSettled);
  const store: CurveStore = {
    tradingDays: (from, to) =>
      Promise.resolve(SESSIONS.filter((d) => d.tradeDate >= from && d.tradeDate <= to)),
    lastSettledTradeDate: () => Promise.resolve(lastSettled),
    latestSnapshots: () =>
      Promise.resolve(
        data.withSnapshot
          ? [
              { contractSymbol: 'CLZ26', capturedAt: at('2026-10-22T14:45:00Z'), last: 77 },
              { contractSymbol: 'CLF27', capturedAt: at('2026-10-22T14:30:00Z'), last: 71 },
            ]
          : [],
      ),
    priceDecimals: () => Promise.resolve(2),
    firstBarDate: () =>
      Promise.resolve(data.firstBarDate === undefined ? '2026-10-14' : data.firstBarDate),
    tradeDates: (from, to) => Promise.resolve(DATES.filter((d) => d >= from && d <= to)),
    contracts: () => Promise.resolve(CONTRACTS),
    frontSymbol: () => Promise.resolve('CLZ26'),
    dailyBars: (symbols, dates) =>
      Promise.resolve(
        bars.filter((b) => symbols.includes(b.contractSymbol) && dates.includes(b.tradeDate)),
      ),
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
    expect(body.points[0].changePct).toBeCloseTo(10);
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
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
  });

  it('모르는 원자재는 404, 잘못된 기준일은 400 VALIDATION_FAILED다', async () => {
    expect((await setup('/v1/commodities/XX/curve')).status).toBe(404);
    const res = await setup('/v1/commodities/CL/curve?baseDate=2026-13-01');
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
  });
});

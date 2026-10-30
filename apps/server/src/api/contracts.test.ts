import { contractsChartSchema } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import type { TradingDaySession } from '../calc/marketState.ts';
import type { QuoteBar } from '../calc/quotes.ts';
import { createApp } from './app.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_CURVE,
  UNUSED_DISPARITY,
  UNUSED_DEVICES,
  UNUSED_ETPS,
} from './commodities.fixtures.ts';
import type { ContractsStore } from './contracts.ts';

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
const SESSIONS = [
  session('2026-10-21', '2026-10-20T22:00:00Z'),
  session('2026-10-22', '2026-10-21T22:00:00Z'),
  session('2026-10-23', '2026-10-22T22:00:00Z'),
];
// 만기순 7개. 비대상 1개(CLH27)를 빼면 5개가 목록이다
const contract = (
  symbol: string,
  contractMonth: string,
  lastTradeDate: string,
  isTarget = true,
) => ({
  symbol,
  contractMonth,
  lastTradeDate,
  isTarget,
});
const CONTRACTS = [
  contract('CLZ26', '2026-12', '2026-11-20'),
  contract('CLF27', '2027-01', '2026-12-18'),
  contract('CLG27', '2027-02', '2027-01-20'),
  contract('CLH27', '2027-03', '2027-02-19', false),
  contract('CLJ27', '2027-04', '2027-03-22'),
  contract('CLK27', '2027-05', '2027-04-21'),
  contract('CLM27', '2027-06', '2027-05-19'),
];
const bar = (contractSymbol: string, tradeDate: string, settle: number): QuoteBar => ({
  contractSymbol,
  tradeDate,
  settle,
  collectedAt: at(`${tradeDate}T23:40:00Z`),
  revisedAt: null,
});
const BARS = CONTRACTS.flatMap((c, i) => [
  bar(c.symbol, '2026-10-20', 70 + i),
  bar(c.symbol, '2026-10-21', 71 + i),
]);

type Data = { withSnapshot?: boolean; bars?: QuoteBar[] };

// DB 대신 메모리. 지금은 10-22 15:00Z = 10-22 장중이고 10-21까지 정산됐다.
function setup(path: string, data: Data = {}) {
  const store: ContractsStore = {
    tradingDays: (from, to) =>
      Promise.resolve(SESSIONS.filter((d) => d.tradeDate >= from && d.tradeDate <= to)),
    lastSettledTradeDate: () => Promise.resolve('2026-10-21'),
    frontSymbols: () => Promise.resolve([{ commodityCode: 'CL', contractSymbol: 'CLZ26' }]),
    latestSnapshots: (symbols) =>
      Promise.resolve(
        data.withSnapshot
          ? [{ contractSymbol: 'CLZ26', capturedAt: at('2026-10-22T14:45:00Z'), last: 77 }].filter(
              (s) => symbols.includes(s.contractSymbol),
            )
          : [],
      ),
    priceDecimals: () => Promise.resolve(2),
    contracts: () => Promise.resolve(CONTRACTS),
    settleHistory: (symbols, tradeDate) =>
      Promise.resolve(
        (data.bars ?? BARS).filter(
          (b) => symbols.includes(b.contractSymbol) && b.tradeDate <= tradeDate,
        ),
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
    curve: UNUSED_CURVE,
    contracts: store,
    devices: UNUSED_DEVICES,
    etps: UNUSED_ETPS,
    now: () => at('2026-10-22T15:00:00Z').getTime(),
  });
  return app.request(path, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

const parse = async (res: Response) =>
  contractsChartSchema.parse(((await res.json()) as { data: unknown }).data);

describe('GET /v1/commodities/:code/contracts', () => {
  it('A와 같은 월물 5개의 정산가 선을 준다', async () => {
    const res = await setup('/v1/commodities/CL/contracts');
    expect(res.status).toBe(200);
    const body = await parse(res);
    expect(body.freshness).toMatchObject({
      tradeDate: '2026-10-22',
      asOf: '2026-10-21T23:40:00.000Z',
      delayed: false,
      marketState: 'OPEN',
    });
    expect(body).toMatchObject({
      priceDecimals: 2,
      dates: ['2026-10-20', '2026-10-21'],
      hasMore: false,
      provisional: false,
    });
    expect(body.contracts.map((c) => c.symbol)).toEqual([
      'CLZ26',
      'CLF27',
      'CLG27',
      'CLJ27',
      'CLK27',
    ]);
    expect(body.contracts[0].prices).toEqual([70, 71]);
  });

  it('before를 주면 그 날짜보다 이른 날짜와 가격만 준다', async () => {
    const body = await parse(await setup('/v1/commodities/CL/contracts?before=2026-10-21'));
    expect(body).toMatchObject({ dates: ['2026-10-20'], hasMore: false });
    expect(body.contracts[0].prices).toEqual([70]);
    expect((await setup('/v1/commodities/CL/contracts?before=x')).status).toBe(400);
  });

  it('장중 스냅숏은 오늘 잠정 값(지연)으로 붙인다', async () => {
    const body = await parse(await setup('/v1/commodities/CL/contracts', { withSnapshot: true }));
    expect(body.dates.at(-1)).toBe('2026-10-22');
    expect(body.provisional).toBe(true);
    expect(body.freshness).toMatchObject({ delayed: true, asOf: '2026-10-22T14:45:00.000Z' });
    expect(body.contracts[0].prices).toEqual([70, 71, 77]);
    expect(body.contracts[1].prices).toEqual([71, 72, null]);
  });

  it('일봉이 없으면 404 NOT_FOUND, 모르는 원자재도 404다', async () => {
    const res = await setup('/v1/commodities/CL/contracts', { bars: [] });
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    expect((await setup('/v1/commodities/XX/contracts')).status).toBe(404);
  });
});

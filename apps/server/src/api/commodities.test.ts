import { commoditiesSchema } from '@futureetp/shared';
import type { Commodities, CommodityCode, Settings } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import type { TradingDaySession } from '../calc/marketState.ts';
import type { QuoteBar, QuoteSnapshot } from '../calc/quotes.ts';
import { createApp } from './app.ts';
import type { CommoditiesStore } from './commodities.ts';
import { UNUSED_CURVE, UNUSED_DISPARITY } from './commodities.fixtures.ts';

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
const DAYS = [
  session('2026-10-21', '2026-10-20T22:00:00Z'),
  session('2026-10-22', '2026-10-21T22:00:00Z'),
  session('2026-10-23', '2026-10-22T22:00:00Z'),
  session('2026-10-26', '2026-10-25T22:00:00Z'),
];

const contract = (commodityCode: CommodityCode, symbol: string, month: string, last: string) => ({
  commodityCode,
  symbol,
  contractMonth: month,
  lastTradeDate: last,
  isTarget: !symbol.startsWith('GCF'),
});
const CONTRACTS = [
  contract('CL', 'CLX26', '2026-11', '2026-10-20'),
  contract('CL', 'CLZ26', '2026-12', '2026-11-19'),
  contract('CL', 'CLF27', '2027-01', '2026-12-17'),
  contract('CL', 'CLG27', '2027-02', '2027-01-20'),
  contract('CL', 'CLH27', '2027-03', '2027-02-19'),
  contract('CL', 'CLJ27', '2027-04', '2027-03-22'),
  contract('CL', 'CLK27', '2027-05', '2027-04-21'),
  contract('GC', 'GCZ26', '2026-12', '2026-12-29'),
  // 비활성 월물
  contract('GC', 'GCF27', '2027-01', '2027-01-27'),
];
// roll_weight FRONT: 행 t = t 종가 뒤 보유할 대표월물
const FRONTS = [
  { commodityCode: 'CL' as const, tradeDate: '2026-10-21', contractSymbol: 'CLZ26' },
  { commodityCode: 'CL' as const, tradeDate: '2026-10-23', contractSymbol: 'CLF27' },
  { commodityCode: 'GC' as const, tradeDate: '2026-10-21', contractSymbol: 'GCZ26' },
];
const bar = (contractSymbol: string, tradeDate: string, settle: number): QuoteBar => ({
  contractSymbol,
  tradeDate,
  settle,
  collectedAt: at(`${tradeDate}T23:35:00Z`),
  revisedAt: null,
});

type Data = {
  days?: TradingDaySession[];
  lastSettled: string | null;
  bars?: QuoteBar[];
  snapshots?: (QuoteSnapshot & { tradeDate: string })[];
};

// DB 대신 메모리. 조건은 db/commoditiesStore.ts 쿼리와 같게 거른다.
function setup(now: string, data: Data) {
  const store: CommoditiesStore = {
    tradingDays: (from, to) =>
      Promise.resolve((data.days ?? DAYS).filter((d) => d.tradeDate >= from && d.tradeDate <= to)),
    lastSettledTradeDate: () => Promise.resolve(data.lastSettled),
    commodities: () =>
      Promise.resolve([
        { code: 'GC', priceDecimals: 1 },
        { code: 'CL', priceDecimals: 2 },
      ]),
    contracts: (tradeDate) =>
      Promise.resolve(CONTRACTS.filter((c) => c.lastTradeDate >= tradeDate)),
    frontSymbols: (tradeDate) =>
      Promise.resolve(
        (['CL', 'GC'] as const).flatMap((code) => {
          const row = FRONTS.findLast((f) => f.commodityCode === code && f.tradeDate <= tradeDate);
          return row ? [row] : [];
        }),
      ),
    dailyBars: (symbols, dates) =>
      Promise.resolve(
        (data.bars ?? []).filter(
          (b) => symbols.includes(b.contractSymbol) && dates.includes(b.tradeDate),
        ),
      ),
    latestSnapshots: (symbols, tradeDate) =>
      Promise.resolve(
        (data.snapshots ?? []).filter(
          (s) => symbols.includes(s.contractSymbol) && s.tradeDate === tradeDate,
        ),
      ),
  };
  const settings = {
    get: () => Promise.resolve({ alertCommodity: 'CL' } as Settings),
    update: () => Promise.reject(new Error('unused')),
  };
  const app = createApp({
    token: TOKEN,
    checkDb: async () => {},
    settings,
    commodities: store,
    disparity: UNUSED_DISPARITY,
    curve: UNUSED_CURVE,
    now: () => at(now).getTime(),
  });
  return app.request('/v1/commodities', { headers: { Authorization: `Bearer ${TOKEN}` } });
}

const parse = async (res: Response) =>
  commoditiesSchema.parse(((await res.json()) as { data: unknown }).data);
const symbols = (data: Commodities, code: CommodityCode) =>
  data.commodities.find((c) => c.code === code)?.contracts.map((c) => c.symbol);

describe('GET /v1/commodities', () => {
  it('장중에는 그 거래일 스냅숏과 직전 정산가 대비를 쓰고, 만기순 대상 월물 5개를 표시 순서대로 준다', async () => {
    const res = await setup('2026-10-22T15:00:00Z', {
      lastSettled: '2026-10-21',
      bars: [bar('CLZ26', '2026-10-21', 80), bar('CLF27', '2026-10-21', 79)],
      snapshots: [
        {
          contractSymbol: 'CLZ26',
          tradeDate: '2026-10-22',
          capturedAt: at('2026-10-22T14:45:00Z'),
          last: 82,
        },
        // 다른 거래일 스냅숏은 쓰지 않는다
        {
          contractSymbol: 'CLF27',
          tradeDate: '2026-10-21',
          capturedAt: at('2026-10-21T20:45:00Z'),
          last: 90,
        },
      ],
    });
    expect(res.status).toBe(200);
    const data = await parse(res);

    expect(data.freshness).toEqual({
      asOf: '2026-10-22T14:45:00.000Z',
      tradeDate: '2026-10-22',
      delayed: true,
      marketState: 'OPEN',
      nextUpdateAt: '2026-10-22T15:05:00.000Z',
    });
    expect(data.commodities.map((c) => [c.code, c.priceDecimals, c.alert])).toEqual([
      ['GC', 1, false],
      ['CL', 2, true],
    ]);
    // 만기된 CLX26·비활성 GCF27은 빠진다
    expect(symbols(data, 'CL')).toEqual(['CLZ26', 'CLF27', 'CLG27', 'CLH27', 'CLJ27']);
    expect(symbols(data, 'GC')).toEqual(['GCZ26']);
    const cl = data.commodities[1].contracts;
    expect(cl[0]).toEqual({
      symbol: 'CLZ26',
      contractMonth: '2026-12',
      price: 82,
      change: 2,
      changePct: 2.5,
      noTrade: false,
      isFront: true,
    });
    expect(cl[1]).toMatchObject({ price: 79, change: null, noTrade: true, isFront: false });
    expect(data.commodities[0].contracts[0]).toMatchObject({ price: null, noTrade: true });
  });

  it('정산이 끝난 주말에는 그 거래일 정산가와 정산 뒤 대표월물을 쓰고, 다음 개장 뒤 갱신 시각을 준다', async () => {
    const res = await setup('2026-10-24T12:00:00Z', {
      lastSettled: '2026-10-23',
      bars: [bar('CLZ26', '2026-10-22', 80), bar('CLZ26', '2026-10-23', 78)],
      snapshots: [
        {
          contractSymbol: 'CLZ26',
          tradeDate: '2026-10-23',
          capturedAt: at('2026-10-23T20:45:00Z'),
          last: 77,
        },
      ],
    });
    const data = await parse(res);

    expect(data.freshness).toEqual({
      asOf: '2026-10-23T23:35:00.000Z',
      tradeDate: '2026-10-23',
      delayed: false,
      marketState: 'CLOSED',
      nextUpdateAt: '2026-10-25T22:05:00.000Z',
    });
    const cl = data.commodities[1].contracts;
    expect(cl[0]).toMatchObject({ symbol: 'CLZ26', price: 78, change: -2, isFront: false });
    expect(cl.find((c) => c.isFront)?.symbol).toBe('CLF27');
  });

  it('거래일 달력이 없으면 INTERNAL', async () => {
    const res = await setup('2026-10-22T15:00:00Z', { days: [], lastSettled: null });
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ success: false, error: { code: 'INTERNAL' } });
  });
});

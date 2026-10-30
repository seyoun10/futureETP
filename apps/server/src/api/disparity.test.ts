import { disparityChartSchema } from '@futureetp/shared';
import type { Basis } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import type { StoredIndexSnapshot } from '../calc/disparityChart.ts';
import type { TradingDaySession } from '../calc/marketState.ts';
import { createApp } from './app.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_CURVE,
  UNUSED_CONTRACTS,
  UNUSED_DEVICES,
  UNUSED_ETPS,
} from './commodities.fixtures.ts';
import type { DisparityStore } from './disparity.ts';

const TOKEN = 'test-token-0123456789abcdef0123456789';
const at = (iso: string) => new Date(iso);
const QUERY = 'basis=KR&ma=20&window=Y10&levels=25,5,10,15,20';

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
];

const bar = (tradeDate: string, close: number) => ({
  tradeDate,
  open: close,
  high: close,
  low: close,
  close,
  inRollPeriod: false,
});

type Data = { rules?: Basis[]; snapshot?: StoredIndexSnapshot | null; empty?: boolean };

// DB 대신 메모리. 기준값별로 지수 수준을 다르게 두어 어느 기준값을 읽었는지 구분한다.
function setup(path: string, data: Data = {}) {
  const level = (basis: Basis) => (basis === 'FRONT' ? 10 : 100);
  const store: DisparityStore = {
    tradingDays: (from, to) =>
      Promise.resolve(DAYS.filter((d) => d.tradeDate >= from && d.tradeDate <= to)),
    lastSettledTradeDate: () => Promise.resolve('2026-10-21'),
    priceDecimals: () => Promise.resolve(2),
    hasRollRule: (_code, basis) => Promise.resolve((data.rules ?? ['KR', 'US']).includes(basis)),
    indexBars: (_code, basis) =>
      Promise.resolve(
        data.empty ? [] : [bar('2026-10-20', level(basis)), bar('2026-10-21', level(basis) * 1.5)],
      ),
    disparities: (_code, basis) =>
      Promise.resolve([{ tradeDate: '2026-10-21', ma: level(basis), disparity: 10 }]),
    weights: () => Promise.resolve([]),
    scale: () =>
      Promise.resolve(data.empty ? null : { ratio: 1, updatedAt: at('2026-10-21T23:50:00Z') }),
    latestIndexSnapshot: () => Promise.resolve(data.snapshot ?? null),
    distribution: () =>
      Promise.resolve(
        data.empty
          ? null
          : { actualStartDate: '2016-10-24', sampleCount: 3, sortedValues: [-10, 0, 10] },
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
    disparity: store,
    curve: UNUSED_CURVE,
    contracts: UNUSED_CONTRACTS,
    devices: UNUSED_DEVICES,
    etps: UNUSED_ETPS,
    now: () => at('2026-10-22T15:00:00Z').getTime(),
  });
  return app.request(path, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

const parse = async (res: Response) =>
  disparityChartSchema.parse(((await res.json()) as { data: unknown }).data);

describe('GET /v1/commodities/:code/disparity', () => {
  it('요청한 기준값의 봉·rare 레벨·분포 기간을 주고, 레벨은 정렬한다', async () => {
    const res = await setup(`/v1/commodities/CL/disparity?${QUERY}`);
    expect(res.status).toBe(200);
    const data = await parse(res);

    expect(data).toMatchObject({
      priceDecimals: 2,
      basis: 'KR',
      fallback: false,
      maPeriod: 20,
      window: 'Y10',
      distribution: { actualStartDate: '2016-10-24', sampleCount: 3 },
      provisional: false,
      currentTail: { side: 'UP', pct: 0 },
    });
    expect(data.freshness).toEqual({
      asOf: '2026-10-21T23:50:00.000Z',
      tradeDate: '2026-10-22',
      delayed: false,
      marketState: 'OPEN',
      nextUpdateAt: '2026-10-22T15:01:00.000Z',
    });
    expect(data.bars.map((b) => b.close)).toEqual([100, 150]);
    expect(data.rareLevels.filter((l) => l.direction === 'UP').map((l) => l.level)).toEqual([
      5, 10, 15, 20, 25,
    ]);
  });

  it('규칙이 없는 원자재는 대표월물로 대신 그리고 fallback을 알린다', async () => {
    const data = await parse(
      await setup(`/v1/commodities/CL/disparity?${QUERY}`, { rules: ['US'] }),
    );

    expect(data).toMatchObject({ basis: 'FRONT', fallback: true });
    expect(data.bars.map((b) => b.close)).toEqual([10, 15]);
  });

  it('그 거래일 스냅숏이 있으면 오늘 잠정 봉을 붙이고 스냅숏 시각·지연으로 표시한다', async () => {
    const data = await parse(
      await setup(`/v1/commodities/CL/disparity?${QUERY}`, {
        snapshot: {
          tradeDate: '2026-10-22',
          capturedAt: at('2026-10-22T14:45:00Z'),
          open: 110,
          high: 112,
          low: 108,
          last: 111,
        },
      }),
    );

    expect(data.provisional).toBe(true);
    expect(data.bars.at(-1)).toMatchObject({ tradeDate: '2026-10-22', close: 111 });
    expect(data.freshness).toMatchObject({ asOf: '2026-10-22T14:45:00.000Z', delayed: true });
  });

  it('적재 전이면 빈 봉과 조회 시각을 준다', async () => {
    const data = await parse(await setup(`/v1/commodities/CL/disparity?${QUERY}`, { empty: true }));

    expect(data).toMatchObject({ bars: [], rareLevels: [], distribution: null, currentTail: null });
    expect(data.freshness.asOf).toBe('2026-10-22T15:00:00.000Z');
  });

  it('모르는 원자재는 NOT_FOUND, 잘못된 query는 VALIDATION_FAILED', async () => {
    const notFound = await setup(`/v1/commodities/XX/disparity?${QUERY}`);
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });

    for (const query of [
      'basis=KR&ma=30&window=Y10&levels=5,10,15,20,25',
      'basis=KR&ma=20&window=Y10&levels=5,10,15,20',
      'basis=KR&ma=20&window=Y10&levels=5,5,15,20,25',
      'basis=KR&ma=20&window=Y10',
    ]) {
      const res = await setup(`/v1/commodities/CL/disparity?${query}`);
      expect(res.status).toBe(400);
      expect(await res.json()).toMatchObject({ error: { code: 'VALIDATION_FAILED' } });
    }
  });
});

import { etpDetailSchema, etpListSchema } from '@futureetp/shared';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.ts';
import {
  UNUSED_COMMODITIES,
  UNUSED_CONTRACTS,
  UNUSED_CURVE,
  UNUSED_DEVICES,
  UNUSED_DISPARITY,
} from './commodities.fixtures.ts';
import type { EtpProductRow, EtpSeriesRow, EtpsStore } from './etps.ts';

const TOKEN = 'test-token-0123456789abcdef0123456789';
const ETF_ID = '6f1c2b8e-3d4a-4f5b-9c6d-7e8f9a0b1c2d';
const ETN_ID = '0b9a8f7e-6d5c-4b4a-9f3e-2d1c0b9a8f7e';

const product = (id: string, fields: Partial<EtpProductRow> = {}): EtpProductRow => ({
  id,
  commodityCode: 'CL',
  market: 'KRX',
  type: 'ETF',
  leverage: 1,
  fxHedge: 'HEDGED',
  name: 'KODEX WTI원유선물(H)',
  nameLang: 'ko',
  issuer: 'KODEX',
  underlyingIndex: 'S&P GSCI Crude Oil Index ER',
  expenseRatio: null,
  issuerUrl: null,
  aum: 35893665344,
  avgTradingValue: 867291785,
  collectedAt: new Date('2026-10-27T23:30:00Z'),
  ...fields,
});
const PRODUCTS = [
  product(ETF_ID),
  product(ETN_ID, {
    type: 'ETN',
    leverage: 2,
    fxHedge: 'UNHEDGED',
    name: '삼성 레버리지 WTI원유 선물 ETN',
    issuer: '삼성',
    aum: null,
    avgTradingValue: null,
    collectedAt: new Date('2026-10-28T23:30:00Z'),
  }),
];
const series = (
  productId: string,
  ticker: string,
  fields: Partial<EtpSeriesRow> = {},
): EtpSeriesRow => ({
  productId,
  ticker,
  seriesCode: null,
  listedDate: null,
  maturityDate: null,
  delistedDate: null,
  ...fields,
});
const SERIES = [
  series(ETF_ID, '261220', { listedDate: '2016-12-27' }),
  series(ETN_ID, '530031', { seriesCode: 'B', listedDate: '2020-03-10' }),
  series(ETN_ID, '530030', {
    seriesCode: 'A',
    listedDate: '2016-06-01',
    delistedDate: '2026-10-20',
  }),
  series(ETN_ID, '530032', { seriesCode: 'C', maturityDate: '2031-03-15' }),
];

// DB 대신 메모리. 원자재 CL만 상품이 있다
function setup(path: string) {
  const etps: EtpsStore = {
    products: (code) => Promise.resolve(PRODUCTS.filter((p) => p.commodityCode === code)),
    product: (id) => Promise.resolve(PRODUCTS.find((p) => p.id === id) ?? null),
    series: (ids) => Promise.resolve(SERIES.filter((s) => ids.includes(s.productId))),
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
    contracts: UNUSED_CONTRACTS,
    devices: UNUSED_DEVICES,
    etps,
  });
  return app.request(path, { headers: { Authorization: `Bearer ${TOKEN}` } });
}

const data = async (res: Response) => ((await res.json()) as { data: unknown }).data;

describe('GET /v1/commodities/:code/etps', () => {
  it('원자재의 상품과 상장 중 종목코드(시리즈 순)를 준다', async () => {
    const res = await setup('/v1/commodities/CL/etps');
    expect(res.status).toBe(200);
    const body = etpListSchema.parse(await data(res));
    expect(body.asOf).toBe('2026-10-28T23:30:00.000Z');
    expect(body.etps).toEqual([
      {
        id: ETF_ID,
        market: 'KRX',
        type: 'ETF',
        leverage: 1,
        fxHedge: 'HEDGED',
        name: 'KODEX WTI원유선물(H)',
        tickers: ['261220'],
        aum: 35893665344,
        avgTradingValue: 867291785,
      },
      expect.objectContaining({
        id: ETN_ID,
        tickers: ['530031', '530032'],
        aum: null,
        avgTradingValue: null,
      }),
    ]);
  });

  it('상품이 없으면 빈 목록과 asOf null, 모르는 원자재는 404다', async () => {
    expect(etpListSchema.parse(await data(await setup('/v1/commodities/NG/etps')))).toEqual({
      asOf: null,
      etps: [],
    });
    expect((await setup('/v1/commodities/XX/etps')).status).toBe(404);
  });
});

describe('GET /v1/etps/:id', () => {
  it('상장 중 시리즈와 첫 시리즈 상장일(폐지 포함)을 준다', async () => {
    const res = await setup(`/v1/etps/${ETN_ID}`);
    expect(res.status).toBe(200);
    const body = etpDetailSchema.parse(await data(res));
    expect(body).toMatchObject({
      id: ETN_ID,
      commodityCode: 'CL',
      nameLang: 'ko',
      issuer: '삼성',
      tickers: ['530031', '530032'],
      listedDate: '2016-06-01',
      collectedAt: '2026-10-28T23:30:00.000Z',
    });
    expect(body.series).toEqual([
      { ticker: '530031', seriesCode: 'B', maturityDate: null },
      { ticker: '530032', seriesCode: 'C', maturityDate: '2031-03-15' },
    ]);
  });

  it('없는 상품이나 uuid가 아닌 id는 404 NOT_FOUND다', async () => {
    for (const id of ['1b2c3d4e-5f60-4718-8a9b-0c1d2e3f4a5b', 'abc']) {
      const res = await setup(`/v1/etps/${id}`);
      expect(res.status).toBe(404);
      expect(await res.json()).toMatchObject({ success: false, error: { code: 'NOT_FOUND' } });
    }
  });
});

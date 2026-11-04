import type { CommodityCode, EtpDetail, EtpList, EtpSummary } from '@futureetp/shared';
import { Hono } from 'hono';
import { z } from 'zod';
import { ApiException } from './errors.ts';
import { commodityCodeParam } from './params.ts';
import { ok } from './response.ts';

export type EtpProductRow = Omit<EtpDetail, 'tickers' | 'listedDate' | 'series' | 'collectedAt'> & {
  collectedAt: Date;
};

export type EtpSeriesRow = {
  productId: string;
  ticker: string;
  seriesCode: string | null;
  listedDate: string | null;
  maturityDate: string | null;
  delistedDate: string | null;
};

export interface EtpsStore {
  // 목록 대상 상품(매핑 끝남·상장 중, data-model.md 4. ETP)
  products(code: CommodityCode): Promise<EtpProductRow[]>;
  // 목록 대상이 아니면 null
  product(id: string): Promise<EtpProductRow | null>;
  // 상장폐지 시리즈 포함
  series(productIds: string[]): Promise<EtpSeriesRow[]>;
}

const summary = (product: EtpProductRow, series: EtpSeriesRow[]): EtpSummary => ({
  id: product.id,
  market: product.market,
  type: product.type,
  leverage: product.leverage,
  fxHedge: product.fxHedge,
  name: product.name,
  tickers: series.filter((s) => s.delistedDate === null).map((s) => s.ticker),
  aum: product.aum,
  avgTradingValue: product.avgTradingValue,
});

// 시리즈는 코드 순(ETF는 하나)
const bySeriesCode = (rows: EtpSeriesRow[]) =>
  [...rows].sort((a, b) => (a.seriesCode ?? '').localeCompare(b.seriesCode ?? ''));

// GET /v1/commodities/:code/etps(C-d). 배치가 저장한 값을 그대로 준다
export async function loadEtpList(store: EtpsStore, code: CommodityCode): Promise<EtpList> {
  const products = await store.products(code);
  const series = await store.series(products.map((p) => p.id));
  const latest = Math.max(...products.map((p) => p.collectedAt.getTime()));
  return {
    asOf: products.length > 0 ? new Date(latest).toISOString() : null,
    etps: products.map((product) =>
      summary(product, bySeriesCode(series.filter((s) => s.productId === product.id))),
    ),
  };
}

// GET /v1/etps/:id(C-d-a). 상장일은 첫 시리즈의 상장일이다(data-model.md)
export async function loadEtpDetail(store: EtpsStore, id: string): Promise<EtpDetail> {
  const product = await store.product(id);
  if (!product) throw new ApiException('NOT_FOUND', `Unknown ETP ${id}`);
  const series = bySeriesCode(await store.series([id]));
  const listedDates = series.flatMap((s) => (s.listedDate ? [s.listedDate] : [])).sort();
  const { collectedAt, ...fields } = product;
  return {
    ...fields,
    ...summary(product, series),
    listedDate: listedDates[0] ?? null,
    series: series
      .filter((s) => s.delistedDate === null)
      .map(({ ticker, seriesCode, maturityDate }) => ({ ticker, seriesCode, maturityDate })),
    collectedAt: collectedAt.toISOString(),
  };
}

export function commodityEtpsRoutes(store: EtpsStore) {
  const routes = new Hono();
  routes.get('/:code/etps', async (c) => {
    const code = commodityCodeParam(c.req.param('code'));
    return ok(c, await loadEtpList(store, code));
  });
  return routes;
}

export function etpsRoutes(store: EtpsStore) {
  const routes = new Hono();
  routes.get('/:id', async (c) => {
    const id = z.uuid().safeParse(c.req.param('id'));
    if (!id.success) throw new ApiException('NOT_FOUND', `Unknown ETP ${c.req.param('id')}`);
    return ok(c, await loadEtpDetail(store, id.data));
  });
  return routes;
}

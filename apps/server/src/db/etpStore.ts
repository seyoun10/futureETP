// 국내 ETP 상품·시리즈 조회·반영(D-096). 흐름은 jobs/etp.ts
import { eq, inArray } from 'drizzle-orm';
import type { KnownEtpProduct } from '../calc/etpSeries.ts';
import type { EtpStore } from '../jobs/etp.ts';
import type { KrxEtpEntry } from '../sources/krxEtp.ts';
import type { db as Db } from './client.ts';
import { etpProduct, etpSeries } from './schema.ts';

type SeriesState = KnownEtpProduct['series'][number];

// ETF는 시리즈 하나라 코드가 없다. ETN 첫 시리즈는 이름에 표기가 없어 A로 둔다
const seriesRow = (productId: string, entry: KrxEtpEntry) => ({
  ticker: entry.ticker,
  productId,
  seriesCode: entry.type === 'ETN' ? (entry.series ?? 'A') : null,
});

export function createEtpStore(db: typeof Db): EtpStore {
  return {
    async krxProducts() {
      const rows = await db
        .select({
          id: etpProduct.id,
          groupingKey: etpProduct.groupingKey,
          isActive: etpProduct.isActive,
          ticker: etpSeries.ticker,
          delistedDate: etpSeries.delistedDate,
        })
        .from(etpProduct)
        .leftJoin(etpSeries, eq(etpSeries.productId, etpProduct.id))
        .where(eq(etpProduct.market, 'KRX'));
      const products = new Map<string, KnownEtpProduct & { series: SeriesState[] }>();
      for (const { id, groupingKey, isActive, ticker, delistedDate } of rows) {
        let product = products.get(id);
        if (!product) {
          product = { id, groupingKey, isActive, series: [] };
          products.set(id, product);
        }
        if (ticker !== null) product.series.push({ ticker, delistedDate });
      }
      return [...products.values()];
    },

    async applyKrxPlan(plan, { baseDate, collectedAt }) {
      await db.transaction(async (tx) => {
        for (const { groupingKey, listings } of plan.newProducts) {
          // 묶인 ETN은 첫 시리즈 이름을 상품 이름으로 쓴다
          const [first] = listings;
          const [{ id }] = await tx
            .insert(etpProduct)
            .values({
              commodityCode: first.commodityCode,
              market: 'KRX',
              type: first.type,
              leverage: first.leverage,
              fxHedge: first.fxHedge,
              name: first.name,
              nameLang: 'ko',
              issuer: first.issuer,
              underlyingIndex: first.underlyingIndex,
              groupingKey,
              source: 'KRX',
              collectedAt,
            })
            .returning({ id: etpProduct.id });
          await tx.insert(etpSeries).values(listings.map((entry) => seriesRow(id, entry)));
        }
        if (plan.addSeries.length > 0) {
          await tx
            .insert(etpSeries)
            .values(plan.addSeries.map(({ productId, listing }) => seriesRow(productId, listing)));
        }
        if (plan.delistTickers.length > 0) {
          await tx
            .update(etpSeries)
            .set({ delistedDate: baseDate })
            .where(inArray(etpSeries.ticker, plan.delistTickers));
        }
        if (plan.relistTickers.length > 0) {
          await tx
            .update(etpSeries)
            .set({ delistedDate: null })
            .where(inArray(etpSeries.ticker, plan.relistTickers));
        }
        if (plan.deactivateProductIds.length > 0) {
          await tx
            .update(etpProduct)
            .set({ isActive: false })
            .where(inArray(etpProduct.id, plan.deactivateProductIds));
        }
        if (plan.reactivateProductIds.length > 0) {
          await tx
            .update(etpProduct)
            .set({ isActive: true })
            .where(inArray(etpProduct.id, plan.reactivateProductIds));
        }
      });
    },

    async setMetrics(metrics, collectedAt) {
      await db.transaction(async (tx) => {
        for (const { productId, aum, avgTradingValue } of metrics) {
          await tx
            .update(etpProduct)
            .set({ aum, avgTradingValue, collectedAt })
            .where(eq(etpProduct.id, productId));
        }
      });
    },

    async setDetails(details) {
      await db.transaction(async (tx) => {
        for (const { productId, issuerUrl, expenseRatio } of details) {
          await tx
            .update(etpProduct)
            .set({ issuerUrl, ...(expenseRatio === undefined ? {} : { expenseRatio }) })
            .where(eq(etpProduct.id, productId));
        }
      });
    },
  };
}

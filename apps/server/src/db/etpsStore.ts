import { and, eq, inArray, isNotNull, type SQL } from 'drizzle-orm';
import type { EtpProductRow, EtpsStore } from '../api/etps.ts';
import type { db as Db } from './client.ts';
import { etpProduct, etpSeries } from './schema.ts';

// 매핑 전 후보는 원자재·유형·배수가 비어 있을 수 있어 목록에서 뺀다(D-025)
const listed = and(
  eq(etpProduct.needsReview, false),
  eq(etpProduct.isActive, true),
  isNotNull(etpProduct.commodityCode),
  isNotNull(etpProduct.type),
  isNotNull(etpProduct.leverage),
);

const columns = {
  id: etpProduct.id,
  commodityCode: etpProduct.commodityCode,
  market: etpProduct.market,
  type: etpProduct.type,
  leverage: etpProduct.leverage,
  fxHedge: etpProduct.fxHedge,
  name: etpProduct.name,
  nameLang: etpProduct.nameLang,
  issuer: etpProduct.issuer,
  underlyingIndex: etpProduct.underlyingIndex,
  expenseRatio: etpProduct.expenseRatio,
  issuerUrl: etpProduct.issuerUrl,
  aum: etpProduct.aum,
  avgTradingValue: etpProduct.avgTradingValue,
  collectedAt: etpProduct.collectedAt,
};

const select = (db: typeof Db, where: SQL | undefined) =>
  db.select(columns).from(etpProduct).where(and(listed, where));

type Row = Awaited<ReturnType<typeof select>>[number];

// where에서 걸렀지만 타입은 nullable이라 한 번 더 좁힌다
function toProduct({ commodityCode, type, leverage, ...rest }: Row) {
  if (commodityCode === null || type === null || leverage === null) return [];
  const product: EtpProductRow = { ...rest, commodityCode, type, leverage };
  return [product];
}

// C-d·C-d-a 조회(api/etps.ts). 값은 ETP 배치가 저장한 그대로다
export function createEtpsStore(db: typeof Db): EtpsStore {
  return {
    async products(code) {
      return (await select(db, eq(etpProduct.commodityCode, code))).flatMap(toProduct);
    },
    async product(id) {
      return (await select(db, eq(etpProduct.id, id))).flatMap(toProduct)[0] ?? null;
    },
    async series(productIds) {
      if (productIds.length === 0) return [];
      return db
        .select({
          productId: etpSeries.productId,
          ticker: etpSeries.ticker,
          seriesCode: etpSeries.seriesCode,
          listedDate: etpSeries.listedDate,
          maturityDate: etpSeries.maturityDate,
          delistedDate: etpSeries.delistedDate,
        })
        .from(etpSeries)
        .where(inArray(etpSeries.productId, productIds));
    },
  };
}

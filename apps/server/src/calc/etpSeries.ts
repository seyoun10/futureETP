// 국내 ETP 목록 한 번(KRX 하루치)을 DB의 상품·시리즈와 맞춰 무엇을 바꿀지 정한다(D-096, data-model.md).
// ETN은 (발행사, 원자재, 배수, 환헤지)가 같으면 후속 시리즈로 같은 상품에 묶는다. ETF는 종목 하나가 상품 하나다.
// 목록에서 사라진 시리즈는 상장폐지, 모든 시리즈가 폐지된 상품은 비활성으로 둔다. 이력은 지우지 않는다.
import type { CommodityCode, EtpType, FxHedge } from '@futureetp/shared';

// 묶기 키 속성은 종목명에서 뽑는다(sources/krxEtpName.ts)
export type EtnAttributes = {
  issuer: string;
  commodityCode: CommodityCode;
  leverage: number;
  fxHedge: FxHedge;
};

export type KrxEtpListing = EtnAttributes & {
  ticker: string;
  type: EtpType;
};

export type KnownEtpProduct = {
  id: string;
  groupingKey: string | null;
  isActive: boolean;
  series: readonly { ticker: string; delistedDate: string | null }[];
};

// 목록 항목에 붙은 다른 필드(이름 등)는 그대로 계획에 실어 보낸다
export type EtpSeriesPlan<L extends KrxEtpListing = KrxEtpListing> = {
  // 묶을 기존 상품이 없는 종목. ETN은 같은 키끼리 한 상품으로 모은다
  newProducts: { groupingKey: string | null; listings: L[] }[];
  // 기존 상품에 붙는 새 시리즈
  addSeries: { productId: string; listing: L }[];
  delistTickers: string[];
  // 폐지로 기록했다가 목록에 다시 나온 종목
  relistTickers: string[];
  deactivateProductIds: string[];
  reactivateProductIds: string[];
};

export function etnGroupingKey({
  issuer,
  commodityCode,
  leverage,
  fxHedge,
}: EtnAttributes): string {
  return `${issuer}|${commodityCode}|${leverage}|${fxHedge}`;
}

export function planKrxEtpSeries<L extends KrxEtpListing>(
  products: readonly KnownEtpProduct[],
  listings: readonly L[],
): EtpSeriesPlan<L> {
  const listed = new Set(listings.map((listing) => listing.ticker));
  const productByTicker = new Map(
    products.flatMap((product) => product.series.map((s) => [s.ticker, product] as const)),
  );
  // 같은 키가 여럿이면 활성 상품을 먼저 고른다
  const productByKey = new Map<string, KnownEtpProduct>();
  for (const product of products) {
    if (product.groupingKey === null) continue;
    const found = productByKey.get(product.groupingKey);
    if (!found || (!found.isActive && product.isActive)) {
      productByKey.set(product.groupingKey, product);
    }
  }

  const plan: EtpSeriesPlan<L> = {
    newProducts: [],
    addSeries: [],
    delistTickers: [],
    relistTickers: [],
    deactivateProductIds: [],
    reactivateProductIds: [],
  };
  const newByKey = new Map<string, L[]>();
  // 이번 목록이 끝난 뒤 상장 중인 시리즈가 있는 상품
  const live = new Set<string>();

  for (const listing of listings) {
    const known = productByTicker.get(listing.ticker);
    if (known) {
      live.add(known.id);
      continue;
    }
    if (listing.type === 'ETF') {
      plan.newProducts.push({ groupingKey: null, listings: [listing] });
      continue;
    }
    const key = etnGroupingKey(listing);
    const product = productByKey.get(key);
    if (product) {
      plan.addSeries.push({ productId: product.id, listing });
      live.add(product.id);
      continue;
    }
    const group = newByKey.get(key);
    if (group) group.push(listing);
    else {
      const created = [listing];
      newByKey.set(key, created);
      plan.newProducts.push({ groupingKey: key, listings: created });
    }
  }

  for (const product of products) {
    for (const { ticker, delistedDate } of product.series) {
      if (!listed.has(ticker) && delistedDate === null) plan.delistTickers.push(ticker);
      if (listed.has(ticker) && delistedDate !== null) plan.relistTickers.push(ticker);
    }
    if (product.isActive && !live.has(product.id)) plan.deactivateProductIds.push(product.id);
    if (!product.isActive && live.has(product.id)) plan.reactivateProductIds.push(product.id);
  }
  return plan;
}

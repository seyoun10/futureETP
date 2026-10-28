// ETP 작업의 미국 부분(D-016, D-099). Nasdaq 스크리너를 매핑표로 나눠 매핑 상품은 저장·갱신하고,
// 새 후보는 needs_review 행으로 둔다(확인 알림은 D-025). 목록에서 빠진 매핑 상품은 폐지·비활성으로 둔다.
// 속성(순자산·총보수는 Nasdaq summary, 상장일·평균 거래대금은 Yahoo chart)은 받은 값만 덮어쓴다.
import { classifyUsListings, US_ETP_MAP, type UsEtpMapping } from '../sources/usEtpMap.ts';
import type { NasdaqEtpSource, UsListing } from '../sources/nasdaqEtp.ts';
import type { YahooEtpSource } from '../sources/yahooEtp.ts';

// 매핑표 상품이 이 비율보다 적게 오면 응답 이상으로 보고 아무것도 반영하지 않는다(대량 폐지 방지)
export const MIN_US_MAPPED_RATIO = 0.5;
export const US_AVG_TRADING_DAYS = 20;

export type KnownUsEtp = {
  id: string;
  ticker: string;
  needsReview: boolean;
  delistedDate: string | null;
};

// 받지 못했거나 값이 없는 필드는 빼서 저장된 값을 둔다
export type UsEtpAttributes = {
  aum?: number;
  expenseRatio?: number;
  listedDate?: string;
  avgTradingValue?: number;
};

export type UsEtpSync = {
  // productId가 null이면 새 상품. 기존 상품(후보였던 행 포함)은 확인 완료·상장 중으로 되돌린다
  upserts: (UsListing & {
    productId: string | null;
    mapping: UsEtpMapping;
    attributes: UsEtpAttributes;
  })[];
  newCandidates: UsListing[];
  delist: { productId: string; ticker: string }[];
  // 후보였다가 목록·후보에서 빠진 행(제외 목록에 더함 등). 확인 전이라 이력 없이 지운다
  dropCandidateIds: string[];
};

export interface UsEtpStore {
  usProducts(): Promise<KnownUsEtp[]>;
  applyUsSync(sync: UsEtpSync, at: { baseDate: string; collectedAt: Date }): Promise<void>;
}

const newYorkDate = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(at);

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

async function fetchAttributes(
  symbol: string,
  nasdaq: NasdaqEtpSource,
  yahoo: YahooEtpSource,
  log: (message: string) => void,
) {
  const attributes: UsEtpAttributes = {};
  let failed = 0;
  try {
    const summary = await nasdaq.summary(symbol);
    if (summary?.aum != null) attributes.aum = summary.aum;
    if (summary?.expenseRatio != null) attributes.expenseRatio = summary.expenseRatio;
  } catch (error) {
    failed++;
    log(`[etp Nasdaq] ${symbol}: ${message(error)}`);
  }
  try {
    const { listedDate, tradingValues } = await yahoo.daily(symbol);
    if (listedDate !== null) attributes.listedDate = listedDate;
    const recent = tradingValues.slice(-US_AVG_TRADING_DAYS);
    if (recent.length > 0) {
      attributes.avgTradingValue = Math.round(
        recent.reduce((total, value) => total + value, 0) / recent.length,
      );
    }
  } catch (error) {
    failed++;
    log(`[etp Yahoo] ${symbol}: ${message(error)}`);
  }
  return { attributes, failed };
}

export async function syncUsEtps({
  nasdaq,
  yahoo,
  store,
  now,
  log,
}: {
  nasdaq: NasdaqEtpSource;
  yahoo: YahooEtpSource;
  store: UsEtpStore;
  now: Date;
  log: (message: string) => void;
}) {
  const { mapped, candidates } = classifyUsListings(await nasdaq.listings());
  const expected = Object.keys(US_ETP_MAP).length;
  if (mapped.length < expected * MIN_US_MAPPED_RATIO) {
    throw new Error(`US: ${mapped.length} of ${expected} mapped ETPs in Nasdaq screener`);
  }

  // 받기를 모두 마친 뒤에 반영한다
  const known = await store.usProducts();
  const knownByTicker = new Map(known.map((product) => [product.ticker, product]));
  const upserts: UsEtpSync['upserts'] = [];
  let failures = 0;
  for (const listing of mapped) {
    const { attributes, failed } = await fetchAttributes(listing.symbol, nasdaq, yahoo, log);
    failures += failed;
    upserts.push({
      ...listing,
      productId: knownByTicker.get(listing.symbol)?.id ?? null,
      attributes,
    });
  }
  if (failures === mapped.length * 2) {
    throw new Error(`US: Nasdaq and Yahoo failed for all ${mapped.length} ETPs`);
  }

  const mappedSymbols = new Set(mapped.map((listing) => listing.symbol));
  const candidateSymbols = new Set(candidates.map((listing) => listing.symbol));
  const sync: UsEtpSync = {
    upserts,
    newCandidates: candidates.filter((listing) => !knownByTicker.has(listing.symbol)),
    delist: known
      .filter(
        (product) =>
          !product.needsReview &&
          product.delistedDate === null &&
          !mappedSymbols.has(product.ticker),
      )
      .map(({ id, ticker }) => ({ productId: id, ticker })),
    dropCandidateIds: known
      .filter(
        (product) =>
          product.needsReview &&
          !mappedSymbols.has(product.ticker) &&
          !candidateSymbols.has(product.ticker),
      )
      .map((product) => product.id),
  };
  const baseDate = newYorkDate(now);
  await store.applyUsSync(sync, { baseDate, collectedAt: now });
  log(
    `[etp US ${baseDate}] ${mapped.length} mapped ` +
      `(+${upserts.filter((u) => u.productId === null).length} new), ` +
      `${sync.newCandidates.length} new candidates (${candidates.length} total), ` +
      `${sync.delist.length} delisted, ${sync.dropCandidateIds.length} dropped candidates; ` +
      `${failures} source failures`,
  );
}

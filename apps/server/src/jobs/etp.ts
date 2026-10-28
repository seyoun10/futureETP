// ETP 작업(08:30 KST): 국내 목록 동기화(D-096). 순자산·평균 거래대금(D-017)과 미국 목록은 뒤에 붙인다.
// KRX 전일분을 받아 종목명을 읽고, 저장된 상품과 맞춘 묶기·상장폐지 계획을 한 트랜잭션으로 반영한다.
import { addDays } from '../calc/tradingCalendar.ts';
import { planKrxEtpSeries, type EtpSeriesPlan, type KnownEtpProduct } from '../calc/etpSeries.ts';
import { toKrxEtpEntries, type KrxEtpEntry, type KrxEtpSource } from '../sources/krxEtp.ts';
import type { JobHandler } from './runner.ts';

// 연휴에도 마지막 거래일에 닿도록 거슬러 볼 날 수
export const KRX_LOOKBACK_DAYS = 10;
// 상장 중으로 저장된 시리즈보다 이 비율 넘게 적게 오면 응답 이상으로 보고 아무것도 반영하지 않는다(대량 폐지 방지)
export const MIN_LISTED_RATIO = 0.5;

export interface EtpStore {
  krxProducts(): Promise<KnownEtpProduct[]>;
  // delistedDate: 목록에서 처음 빠진 기준일
  applyKrxPlan(
    plan: EtpSeriesPlan<KrxEtpEntry>,
    at: { baseDate: string; collectedAt: Date },
  ): Promise<void>;
}

const seoulDate = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(at);

// KRX는 다음 날 08:00 KST에 전일분을 낸다. 휴장일·반영 전이면 빈 배열이라 하루씩 거슬러 간다
async function latestKrxDay(source: KrxEtpSource, now: Date) {
  const start = addDays(seoulDate(now), -1);
  for (let i = 0; i < KRX_LOOKBACK_DAYS; i++) {
    const date = addDays(start, -i);
    const day = await source.fetchDay(date);
    if (day.etf.length === 0 && day.etn.length === 0) continue;
    if (day.etf.length === 0 || day.etn.length === 0) {
      throw new Error(`KRX ${date}: ETF ${day.etf.length} rows, ETN ${day.etn.length} rows`);
    }
    return { date, day };
  }
  throw new Error(`KRX: no ETP data in ${KRX_LOOKBACK_DAYS} days before ${start}`);
}

export function createEtpHandler({
  source,
  store,
  log = console.log,
}: {
  source: KrxEtpSource;
  store: EtpStore;
  log?: (message: string) => void;
}): JobHandler {
  return async ({ now }) => {
    const { date, day } = await latestKrxDay(source, now);
    const listings = [...toKrxEtpEntries(day.etf, 'ETF'), ...toKrxEtpEntries(day.etn, 'ETN')];
    const products = await store.krxProducts();
    const listedCount = products
      .flatMap((product) => product.series)
      .filter((series) => series.delistedDate === null).length;
    if (listings.length < listedCount * MIN_LISTED_RATIO) {
      throw new Error(
        `KRX ${date}: ${listings.length} commodity ETPs, ${listedCount} listed in DB`,
      );
    }

    const plan = planKrxEtpSeries(products, listings);
    await store.applyKrxPlan(plan, { baseDate: date, collectedAt: now });
    log(
      `[etp KRX ${date}] ${listings.length} listings: +${plan.newProducts.length} products, ` +
        `+${plan.addSeries.length} series, ${plan.delistTickers.length} delisted, ` +
        `${plan.relistTickers.length} relisted, ${plan.deactivateProductIds.length} deactivated, ` +
        `${plan.reactivateProductIds.length} reactivated`,
    );
  };
}

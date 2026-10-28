// ETP 작업(08:30 KST): 국내 목록 동기화(D-096)와 순자산·평균 거래대금(D-017). 미국 목록은 뒤에 붙인다.
// KRX 전일분을 받아 종목명을 읽고, 저장된 상품과 맞춘 묶기·상장폐지 계획을 한 트랜잭션으로 반영한다.
// 그다음 상장 중인 시리즈로 상품별 순자산(기준일)과 최근 20거래일 평균 거래대금을 덮어쓴다.
import { etpProductMetrics, type EtpMetrics } from '../calc/etpMetrics.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import { planKrxEtpSeries, type EtpSeriesPlan, type KnownEtpProduct } from '../calc/etpSeries.ts';
import {
  krxAumByTicker,
  krxTradingValueByTicker,
  toKrxEtpEntries,
  type KrxEtpDay,
  type KrxEtpEntry,
  type KrxEtpSource,
} from '../sources/krxEtp.ts';
import type { JobHandler } from './runner.ts';

// 연휴에도 마지막 거래일에 닿도록 거슬러 볼 날 수
export const KRX_LOOKBACK_DAYS = 10;
// 상장 중으로 저장된 시리즈보다 이 비율 넘게 적게 오면 응답 이상으로 보고 아무것도 반영하지 않는다(대량 폐지 방지)
export const MIN_LISTED_RATIO = 0.5;
// 평균 거래대금 창(기준일 포함, D-017)과 그 거래일을 찾으려 기준일 전으로 거슬러 볼 날 수(설·추석 연휴 포함)
export const AVG_TRADING_DAYS = 20;
export const TRADING_VALUE_LOOKBACK_DAYS = 40;

export interface EtpStore {
  krxProducts(): Promise<KnownEtpProduct[]>;
  // delistedDate: 목록에서 처음 빠진 기준일
  applyKrxPlan(
    plan: EtpSeriesPlan<KrxEtpEntry>,
    at: { baseDate: string; collectedAt: Date },
  ): Promise<void>;
  setMetrics(metrics: readonly EtpMetrics[], collectedAt: Date): Promise<void>;
}

const seoulDate = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(at);

// from부터 하루씩 거슬러 목록이 있는 날(거래일)만 낸다. 휴장일·반영 전이면 빈 배열이다
async function* krxTradingDays(source: KrxEtpSource, from: string, calendarDays: number) {
  for (let i = 0; i < calendarDays; i++) {
    const date = addDays(from, -i);
    const day = await source.fetchDay(date);
    if (day.etf.length === 0 && day.etn.length === 0) continue;
    if (day.etf.length === 0 || day.etn.length === 0) {
      throw new Error(`KRX ${date}: ETF ${day.etf.length} rows, ETN ${day.etn.length} rows`);
    }
    yield { date, day };
  }
}

// KRX는 다음 날 08:00 KST에 전일분을 낸다
async function latestKrxDay(source: KrxEtpSource, now: Date) {
  const start = addDays(seoulDate(now), -1);
  for await (const found of krxTradingDays(source, start, KRX_LOOKBACK_DAYS)) return found;
  throw new Error(`KRX: no ETP data in ${KRX_LOOKBACK_DAYS} days before ${start}`);
}

// 기준일 앞 거래일들. 거래일이 모자라면(신규 시스템 등) 찾은 만큼만 쓴다
async function earlierKrxDays(source: KrxEtpSource, baseDate: string) {
  const days: KrxEtpDay[] = [];
  const from = addDays(baseDate, -1);
  for await (const { day } of krxTradingDays(source, from, TRADING_VALUE_LOOKBACK_DAYS)) {
    days.push(day);
    if (days.length === AVG_TRADING_DAYS - 1) break;
  }
  return days;
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

    // 받기를 모두 마친 뒤에 반영한다(중간 실패 시 아무것도 바꾸지 않도록)
    const tradingDays = [day, ...(await earlierKrxDays(source, date))];
    const plan = planKrxEtpSeries(products, listings);
    await store.applyKrxPlan(plan, { baseDate: date, collectedAt: now });
    // 반영 뒤 시리즈 구성(새 상품·폐지)으로 다시 읽어 합산한다
    const metrics = etpProductMetrics(
      await store.krxProducts(),
      krxAumByTicker(day),
      tradingDays.map(krxTradingValueByTicker),
    );
    await store.setMetrics(metrics, now);
    log(
      `[etp KRX ${date}] ${listings.length} listings: +${plan.newProducts.length} products, ` +
        `+${plan.addSeries.length} series, ${plan.delistTickers.length} delisted, ` +
        `${plan.relistTickers.length} relisted, ${plan.deactivateProductIds.length} deactivated, ` +
        `${plan.reactivateProductIds.length} reactivated; ` +
        `metrics for ${metrics.length} products over ${tradingDays.length} trading days`,
    );
  };
}

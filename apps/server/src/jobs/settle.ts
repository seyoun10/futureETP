// 일일 정산(D-047, D-071). ① DAILY_SETTLE: 밀린 거래일까지 일봉 저장 → 원자재별 전체 재계산. 성공 = 정산 대기 해제.
// ② SETTLE_REVISION: 직전 거래일 일봉을 다시 받아 바뀐 원자재만 재계산. 마지막 실행이 실패면 알림 판정을 멈춘다.
// ③ SETTLE_BACKFILL(주말): 최근 정산일에 빠진 봉을 채운다(D-110).
import type { CommodityCode } from '@futureetp/shared';
import type { TradingDaySession } from '../calc/marketState.ts';
import { isTargetMonth, type ActiveMonthRule } from '../calc/monthList.ts';
import {
  findRevisedBars,
  planSettle,
  revisionTradeDate,
  type BarValues,
} from '../calc/settlement.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import type { JobName, Source } from '../constants.ts';
import { tradesOn } from '../sources/settlement.ts';
import type { SettlementSource } from '../sources/settlement.ts';
import { forEachCommodity, type JobHandler } from './runner.ts';

export type NewContract = {
  symbol: string;
  commodityCode: CommodityCode;
  contractMonth: string;
  firstTradeDate: string | null;
  lastTradeDate: string;
  isTarget: boolean;
};

export type DailyBarRow = BarValues & {
  tradeDate: string;
  source: Source;
  collectedAt: Date;
  revisedAt: Date | null;
};

export type StoredBar = BarValues & { source: Source; revisedAt: Date | null };

export type SettleContract = {
  symbol: string;
  firstTradeDate: string | null;
  lastTradeDate: string;
  isTarget: boolean;
};

export interface SettleStore {
  // 오름차순, from·to 포함
  tradingDays(from: string, to: string): Promise<TradingDaySession[]>;
  // 그 작업이 성공한 가장 최근 거래일
  lastSuccessTradeDate(job: JobName): Promise<string | null>;
  // daily_bar의 가장 최근 거래일(적재·이전 정산 데이터)
  lastDailyBarDate(): Promise<string | null>;
  activeMonthRules(commodityCode: CommodityCode): Promise<ActiveMonthRule[]>;
  contracts(commodityCode: CommodityCode): Promise<SettleContract[]>;
  // 이미 있는 월물은 그대로 둔다
  insertContracts(rows: readonly NewContract[]): Promise<void>;
  dailyBars(commodityCode: CommodityCode, tradeDate: string): Promise<StoredBar[]>;
  // from~to(포함)에 그 소스로 저장된 일봉의 (월물, 거래일)
  sourceBarDates(
    commodityCode: CommodityCode,
    source: Source,
    from: string,
    to: string,
  ): Promise<{ contractSymbol: string; tradeDate: string }[]>;
  // (월물, 거래일)이 있으면 값을 바꾼다
  upsertDailyBars(rows: readonly DailyBarRow[]): Promise<void>;
}

export type SettleDeps = {
  store: SettleStore;
  source: SettlementSource;
  // 원자재 하나의 세 기준값 전체 재계산(jobs/recompute.ts)
  recompute: (commodityCode: CommodityCode, now: Date) => Promise<void>;
  log?: (message: string) => void;
};

// now 앞 30일(따라잡기 5거래일 + 연휴)부터 다음 날까지의 거래일
const CALENDAR_LOOKBACK_DAYS = 30;

function loadDays(store: SettleStore, now: Date) {
  const today = now.toISOString().slice(0, 10);
  return store.tradingDays(addDays(today, -CALENDAR_LOOKBACK_DAYS), addDays(today, 1));
}

// 원자재마다 일봉을 받는 월물 수: 최종 거래일이 가까운 쪽부터. 커브 상한(D-018 당시 24개) + 2.
// 먼 월물은 지수·커브에 쓰지 않고, 소스 호출 제한(Massive 분당 5회)에 묶인다(D-095)
export const MAX_SETTLE_CONTRACTS = 26;

// 주말 보충이 다시 보는 정산 거래일 수. Massive는 월물마다 봉이 있는 최근 10세션을 준다(D-110)
export const BACKFILL_DAYS = 10;

// 평일 정산은 직전 10거래일 동안 지금 소스 봉이 없던 월물(드문 월물)을 건너뛴다. 그 사이 체결은 주말 보충이 채운다(D-110)
export const SKIP_LOOKBACK_DAYS = 10;
// 건너뛰지 않는 월물: 가까운 2개(지수 대표·다음 월물)와 가까운 대상 월물 5개(A·C-c, D-110)
export const PROTECTED_NEAREST = 2;
export const PROTECTED_TARGETS = 5;

// 그날 거래되는 월물 중 일봉을 받는 월물(최종 거래일, 같으면 심볼 순)
function settleContracts(contracts: readonly SettleContract[], tradeDate: string) {
  return contracts
    .filter((c) => tradesOn(c, tradeDate))
    .sort(
      (a, b) => a.lastTradeDate.localeCompare(b.lastTradeDate) || a.symbol.localeCompare(b.symbol),
    )
    .slice(0, MAX_SETTLE_CONTRACTS);
}

const settleSymbols = (contracts: readonly SettleContract[], tradeDate: string) =>
  settleContracts(contracts, tradeDate).map((c) => c.symbol);

const isProtected = (c: SettleContract, index: number, sorted: readonly SettleContract[]) =>
  index < PROTECTED_NEAREST ||
  (c.isTarget && sorted.slice(0, index).filter((x) => x.isTarget).length < PROTECTED_TARGETS);

export function createSettleHandlers({ store, source, recompute, log = console.log }: SettleDeps): {
  DAILY_SETTLE: JobHandler;
  SETTLE_REVISION: JobHandler;
  SETTLE_BACKFILL: JobHandler;
} {
  // 월물 상장(소스의 새 월물 추가) → 그날 거래되는 월물의 일봉 저장.
  // 이미 받은 날은 건너뛴다(다른 원자재 실패로 재시도·따라잡기할 때 소스 호출을 아낌)
  async function collectDay(
    code: CommodityCode,
    tradeDate: string,
    days: readonly TradingDaySession[],
    now: Date,
  ) {
    if ((await store.dailyBars(code, tradeDate)).length > 0) {
      log(`[settle ${code} ${tradeDate}] already collected`);
      return;
    }
    const [rules, definitions] = await Promise.all([
      store.activeMonthRules(code),
      source.listContracts(code, tradeDate),
    ]);
    await store.insertContracts(
      definitions.map((d) => ({
        ...d,
        commodityCode: code,
        isTarget: isTargetMonth(d.contractMonth, rules),
      })),
    );

    const candidates = settleContracts(await store.contracts(code), tradeDate);
    // 직전 10거래일을 모두 지금 소스로 정산했을 때만 건너뛴다(소스 전환·적재 직후 오판 방지)
    const lookback = days
      .map((d) => d.tradeDate)
      .filter((d) => d < tradeDate)
      .slice(-SKIP_LOOKBACK_DAYS);
    const recent =
      lookback.length === SKIP_LOOKBACK_DAYS
        ? await store.sourceBarDates(code, source.name, lookback[0], lookback.at(-1) ?? tradeDate)
        : [];
    const canSkip = new Set(recent.map((b) => b.tradeDate)).size === SKIP_LOOKBACK_DAYS;
    const traded = new Set(recent.map((b) => b.contractSymbol));
    const symbols = candidates
      .filter((c, i, sorted) => !canSkip || traded.has(c.symbol) || isProtected(c, i, sorted))
      .map((c) => c.symbol);
    const bars = await source.fetchDailyBars(code, symbols, tradeDate);
    // 소스 반영 전(D-019)이면 실패로 끝내 재시도에 맡긴다
    if (bars.length === 0) throw new Error(`${tradeDate}: no bars from ${source.name} yet`);
    const unknown = bars.filter((b) => !symbols.includes(b.contractSymbol));
    if (unknown.length > 0) {
      throw new Error(
        `${tradeDate}: unexpected symbols ${unknown.map((b) => b.contractSymbol).join(', ')}`,
      );
    }
    await store.upsertDailyBars(
      bars.map((b) => ({
        ...b,
        tradeDate,
        source: source.name,
        collectedAt: now,
        revisedAt: null,
      })),
    );
    log(
      `[settle ${code} ${tradeDate}] ${bars.length} bars, skipped ${candidates.length - symbols.length}`,
    );
  }

  const DAILY_SETTLE: JobHandler = async (ctx) => {
    const days = await loadDays(store, ctx.now);
    // 정산 이력이 없으면(적재 직후) 저장된 일봉의 마지막 날 다음부터 따라잡는다
    const lastSettled =
      (await store.lastSuccessTradeDate('DAILY_SETTLE')) ?? (await store.lastDailyBarDate());
    const plan = planSettle(ctx.now, days, lastSettled);
    ctx.tradeDate = plan.tradeDate;
    if (plan.dates.length === 0) {
      log(`[settle] ${plan.tradeDate} already settled`);
      return;
    }
    await forEachCommodity('Settle', async (code) => {
      for (const date of plan.dates) await collectDay(code, date, days, ctx.now);
      await recompute(code, ctx.now);
    });
  };

  const SETTLE_REVISION: JobHandler = async (ctx) => {
    const days = await loadDays(store, ctx.now);
    const tradeDate = revisionTradeDate(ctx.now, days);
    if (tradeDate === null) {
      log('[revision] no previous trading day');
      return;
    }
    ctx.tradeDate = tradeDate;
    const [settled, revised] = await Promise.all([
      store.lastSuccessTradeDate('DAILY_SETTLE'),
      store.lastSuccessTradeDate('SETTLE_REVISION'),
    ]);
    // 확인하지 못했으므로 실패로 남긴다(성공으로 남기면 알림 판정 중지가 풀리고 그날이 확인된 것으로 친다)
    if (settled === null || settled < tradeDate) {
      throw new Error(`${tradeDate} not settled yet`);
    }
    if (revised !== null && revised >= tradeDate) {
      log(`[revision] ${tradeDate} already checked`);
      return;
    }

    await forEachCommodity('Revision', async (code) => {
      // 지금 소스로 받은 일봉만 다시 확인한다. 적재 등 다른 소스 일봉은 거래량 기준이 달라(D-095)
      // 모두 정정으로 잡히고, 거래 없는 월물은 소스에서 빠져 확인에 실패한다
      const stored = (await store.dailyBars(code, tradeDate)).filter(
        (b) => b.source === source.name,
      );
      if (stored.length === 0) return;
      const fetched = await source.fetchDailyBars(
        code,
        stored.map((b) => b.contractSymbol),
        tradeDate,
      );
      // 보호 월물(가까운 2개·대상 월물 5개)이 빠지면 정정 여부를 알 수 없어 실패한다. 드문 월물 봉은
      // 다음 세션이 열린 뒤 사라졌다가 며칠 뒤 다시 나오므로(D-110) 로그만 남기고 확인하지 않는다
      const fetchedSymbols = new Set(fetched.map((b) => b.contractSymbol));
      const missing = stored
        .map((b) => b.contractSymbol)
        .filter((symbol) => !fetchedSymbols.has(symbol));
      if (missing.length > 0) {
        const protectedSymbols = new Set(
          settleContracts(await store.contracts(code), tradeDate)
            .filter(isProtected)
            .map((c) => c.symbol),
        );
        const lost = missing.filter((symbol) => protectedSymbols.has(symbol));
        if (lost.length > 0) {
          throw new Error(`${tradeDate}: missing from ${source.name}: ${lost.join(', ')}`);
        }
        log(
          `[revision ${code} ${tradeDate}] not in ${source.name}, unchecked: ${missing.join(', ')}`,
        );
      }
      const changed = findRevisedBars(stored, fetched);
      if (changed.length > 0) {
        await store.upsertDailyBars(
          changed.map((b) => ({
            ...b,
            tradeDate,
            source: source.name,
            collectedAt: ctx.now,
            revisedAt: ctx.now,
          })),
        );
        log(`[revision ${code} ${tradeDate}] ${changed.map((b) => b.contractSymbol).join(', ')}`);
      }
      // 이전 시도가 정정만 저장하고 재계산에서 실패했어도 다시 계산한다
      if (changed.length > 0 || stored.some((b) => b.revisedAt !== null)) {
        await recompute(code, ctx.now);
      }
    });
  };

  // 정산 때 빠진 봉을 채운다(D-110): 17:00 CT 뒤 다음 세션으로 넘어갔다가 며칠 뒤 다시 나온 드문 월물 봉,
  // 일부 월물만 반영된 날 등. 저장된 봉은 건드리지 않고, 채운 원자재만 다시 계산한다
  const SETTLE_BACKFILL: JobHandler = async (ctx) => {
    const settled = await store.lastSuccessTradeDate('DAILY_SETTLE');
    const dates = (await loadDays(store, ctx.now))
      .map((d) => d.tradeDate)
      .filter((d) => settled !== null && d <= settled)
      .slice(-BACKFILL_DAYS);
    if (dates.length === 0) {
      log('[backfill] no settled trading day');
      return;
    }
    ctx.tradeDate = dates.at(-1);

    await forEachCommodity('Backfill', async (code) => {
      const contracts = await store.contracts(code);
      // 날짜마다 받는 월물 중 저장된 봉이 없는 (월물, 날짜)
      const missing = new Set<string>();
      for (const date of dates) {
        const stored = new Set((await store.dailyBars(code, date)).map((b) => b.contractSymbol));
        for (const symbol of settleSymbols(contracts, date)) {
          if (!stored.has(symbol)) missing.add(`${symbol}|${date}`);
        }
      }
      if (missing.size === 0) return;

      const symbols = [...new Set([...missing].map((key) => key.split('|')[0]))];
      const found = (await source.fetchRecentBars(code, symbols, dates[0])).filter((b) =>
        missing.has(`${b.contractSymbol}|${b.tradeDate}`),
      );
      log(`[backfill ${code}] ${found.length} of ${missing.size} missing bars`);
      if (found.length === 0) return;
      await store.upsertDailyBars(
        found.map((b) => ({ ...b, source: source.name, collectedAt: ctx.now, revisedAt: null })),
      );
      log(
        `[backfill ${code}] ${found.map((b) => `${b.contractSymbol} ${b.tradeDate}`).join(', ')}`,
      );
      await recompute(code, ctx.now);
    });
  };

  return { DAILY_SETTLE, SETTLE_REVISION, SETTLE_BACKFILL };
}

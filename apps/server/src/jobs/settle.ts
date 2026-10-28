// 일일 정산(D-047, D-071). ① DAILY_SETTLE: 밀린 거래일까지 일봉 저장 → 원자재별 전체 재계산. 성공 = 정산 대기 해제.
// ② SETTLE_REVISION: 직전 거래일 일봉을 다시 받아 바뀐 원자재만 재계산. 마지막 실행이 실패면 알림 판정을 멈춘다.
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

export interface SettleStore {
  // 오름차순, from·to 포함
  tradingDays(from: string, to: string): Promise<TradingDaySession[]>;
  // 그 작업이 성공한 가장 최근 거래일
  lastSuccessTradeDate(job: JobName): Promise<string | null>;
  // daily_bar의 가장 최근 거래일(적재·이전 정산 데이터)
  lastDailyBarDate(): Promise<string | null>;
  activeMonthRules(commodityCode: CommodityCode): Promise<ActiveMonthRule[]>;
  contracts(
    commodityCode: CommodityCode,
  ): Promise<{ symbol: string; firstTradeDate: string | null; lastTradeDate: string }[]>;
  // 이미 있는 월물은 그대로 둔다
  insertContracts(rows: readonly NewContract[]): Promise<void>;
  dailyBars(commodityCode: CommodityCode, tradeDate: string): Promise<StoredBar[]>;
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

// 원자재마다 일봉을 받는 월물 수: 최종 거래일이 가까운 쪽부터. 커브 상한 24개(D-018) + 2.
// 먼 월물은 지수·커브에 쓰지 않고, 소스 호출 제한(Massive 분당 5회)에 묶인다(D-095)
export const MAX_SETTLE_CONTRACTS = 26;

export function createSettleHandlers({ store, source, recompute, log = console.log }: SettleDeps): {
  DAILY_SETTLE: JobHandler;
  SETTLE_REVISION: JobHandler;
} {
  // 월물 상장(소스의 새 월물 추가) → 그날 거래되는 월물의 일봉 저장.
  // 이미 받은 날은 건너뛴다(다른 원자재 실패로 재시도·따라잡기할 때 소스 호출을 아낌)
  async function collectDay(code: CommodityCode, tradeDate: string, now: Date) {
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

    const symbols = (await store.contracts(code))
      .filter((c) => tradesOn(c, tradeDate))
      .sort(
        (a, b) =>
          a.lastTradeDate.localeCompare(b.lastTradeDate) || a.symbol.localeCompare(b.symbol),
      )
      .slice(0, MAX_SETTLE_CONTRACTS)
      .map((c) => c.symbol);
    const bars = await source.fetchDailyBars(code, symbols, tradeDate);
    // 소스 반영 전(D-019)이면 15분 뒤 재시도한다
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
    log(`[settle ${code} ${tradeDate}] ${bars.length} bars`);
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
      for (const date of plan.dates) await collectDay(code, date, ctx.now);
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
      // 빠진 월물이 있으면 정정 여부를 알 수 없다
      const fetchedSymbols = new Set(fetched.map((b) => b.contractSymbol));
      const missing = stored.filter((b) => !fetchedSymbols.has(b.contractSymbol));
      if (missing.length > 0) {
        throw new Error(
          `${tradeDate}: missing from ${source.name}: ${missing.map((b) => b.contractSymbol).join(', ')}`,
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

  return { DAILY_SETTLE, SETTLE_REVISION };
}

// 장중 배치 INTRADAY(D-012, D-022, D-094). 장 상태가 OPEN일 때만 돈다(정산 대기·휴장·정지 구간은 건너뜀).
// 원자재마다 커브 월물 장중 값(intraday_snapshot) → 기준값별 잠정 지수·이격도(index_snapshot)를 저장한다.
// 알림 판정 대상 원자재면 저장 뒤 rare 레벨 알림을 판정한다(jobs/rareAlert.ts).
// 장 상태와 상관없이 먼저 지난 슬롯의 RETRY 알림을 다시 보낸다(D-023).
import { BASES, type Basis, type CommodityCode } from '@futureetp/shared';
import {
  indexAnchor,
  intradayCurveContracts,
  intradayIndex,
  type IndexHistoryRow,
  type IntradayIndex,
} from '../calc/intraday.ts';
import { marketStatus, type TradingDaySession } from '../calc/marketState.ts';
import type { ListedContract } from '../calc/monthList.ts';
import { addDays } from '../calc/tradingCalendar.ts';
import type { IntradayQuote, IntradaySource } from '../sources/intraday.ts';
import type { AlertRetry, RareAlert } from './rareAlert.ts';
import { errorMessage, forEachCommodity, type JobHandler } from './runner.ts';

export type IntradaySnapshotRow = IntradayQuote & { capturedAt: Date; tradeDate: string };

export type IndexSnapshotRow = IntradayIndex & {
  commodityCode: CommodityCode;
  basis: Basis;
  capturedAt: Date;
  tradeDate: string;
};

// roll_weight 한 행
export type HeldWeightRow = {
  basis: Basis;
  tradeDate: string;
  contractSymbol: string;
  weight: number;
};

export interface IntradayStore {
  // 오름차순, from·to 포함
  tradingDays(from: string, to: string): Promise<TradingDaySession[]>;
  lastSettledTradeDate(): Promise<string | null>;
  // 최종 거래일이 fromDate 이후인 그 원자재의 월물
  contracts(commodityCode: CommodityCode, fromDate: string): Promise<ListedContract[]>;
  // 기준값마다 그 날짜 전(미만) 가장 최근 거래일의 roll_weight 행 = 그날 보유 비중
  heldWeights(commodityCode: CommodityCode, before: string): Promise<HeldWeightRow[]>;
  // 그 날짜 전(미만) index_bar 최근 limit행, 오름차순
  indexHistory(
    commodityCode: CommodityCode,
    basis: Basis,
    before: string,
    limit: number,
  ): Promise<IndexHistoryRow[]>;
  // 같은 (월물|기준값, 시각)이 있으면 값을 바꾼다(재시도)
  save(quotes: readonly IntradaySnapshotRow[], indexes: readonly IndexSnapshotRow[]): Promise<void>;
}

export type IntradayDeps = {
  store: IntradayStore;
  source: IntradaySource;
  // 없으면 스냅숏만 저장한다(발송기 연결 전)
  alert?: RareAlert;
  retry?: AlertRetry;
  log?: (message: string) => void;
};

// 직전 거래일(휴장 연휴)과 그날 세션을 찾을 만큼 읽는다
const LOOKBACK_DAYS = 30;
// 이평선 200의 직전 유효 종가 199개 + 무효일 여유
export const INDEX_HISTORY_ROWS = 260;
// captured_at은 배치 슬롯(CT :00/:15/:30/:45 = UTC 15분 배수) 시각이다. 재시도해도 같은 행이 된다
const SLOT_MS = 15 * 60_000;

export const batchSlot = (now: Date) => new Date(Math.floor(now.getTime() / SLOT_MS) * SLOT_MS);

export function createIntradayHandler({
  store,
  source,
  alert,
  retry,
  log = console.log,
}: IntradayDeps): JobHandler {
  return async (ctx) => {
    const capturedAt = batchSlot(ctx.now);
    // 재발송이 실패해도 장중 값은 받고, 작업은 마지막에 실패로 남긴다
    let retryFailure: string | null = null;
    if (retry) {
      try {
        await retry({ before: capturedAt, now: ctx.now });
      } catch (error) {
        retryFailure = `alert retry ${errorMessage(error)}`;
        log(`[intraday] ${retryFailure}`);
      }
    }
    await judge(ctx, capturedAt);
    if (retryFailure !== null) throw new Error(retryFailure);
  };

  async function judge(ctx: Parameters<JobHandler>[0], capturedAt: Date): Promise<void> {
    const today = ctx.now.toISOString().slice(0, 10);
    const [days, lastSettled] = await Promise.all([
      store.tradingDays(addDays(today, -LOOKBACK_DAYS), addDays(today, 1)),
      store.lastSettledTradeDate(),
    ]);
    const status = marketStatus(ctx.now, days, lastSettled);
    if (status.state !== 'OPEN' || status.tradeDate === null) {
      log(`[intraday] skipped: ${status.state}`);
      return;
    }
    const tradeDate = status.tradeDate;
    ctx.tradeDate = tradeDate;
    // OPEN이면 세션 행과 정산된 직전 거래일 행이 있다
    const index = days.findIndex((d) => d.tradeDate === tradeDate);
    const sessionOpenAt = days[index].sessionOpenAt!;
    const previous = days[index - 1].tradeDate;

    await forEachCommodity('Intraday', async (code) => {
      const [contracts, held] = await Promise.all([
        store.contracts(code, tradeDate),
        store.heldWeights(code, tradeDate),
      ]);
      const weights = Map.groupBy(
        held.filter((w) => w.weight > 0),
        (w) => w.basis,
      );
      // 지수에 쓰는 월물은 chart(세션 값), 나머지 커브 월물은 spark(현재가)
      const indexSymbols = [...new Set(held.map((w) => w.contractSymbol))];
      const curveOnly = intradayCurveContracts(contracts, tradeDate)
        .map((c) => c.symbol)
        .filter((s) => !indexSymbols.includes(s));
      const quotes = [
        ...(await source.fetchSessionQuotes(indexSymbols, sessionOpenAt)),
        ...(await source.fetchLastPrices(curveOnly)),
      ];
      const prices = new Map(quotes.map((q) => [q.contractSymbol, q]));

      const indexes: IndexSnapshotRow[] = [];
      const failures: string[] = [];
      for (const basis of BASES) {
        const rows = weights.get(basis);
        // 규칙이 없는 기준값
        if (rows === undefined) continue;
        try {
          // 직전 거래일 정산·재계산 결과에 이어 붙인다. 날짜가 어긋나면 지수가 틀린다
          const history = await store.indexHistory(code, basis, tradeDate, INDEX_HISTORY_ROWS);
          const barDate = history[history.length - 1]?.tradeDate ?? null;
          if (rows[0].tradeDate !== previous || barDate !== previous) {
            throw new Error(
              `expected ${previous}, roll_weight ${rows[0].tradeDate}, index_bar ${barDate}`,
            );
          }
          const anchor = indexAnchor(history);
          if (anchor === null) {
            log(`[intraday ${code} ${basis}] no valid index bar`);
            continue;
          }
          const value = intradayIndex(
            anchor,
            rows.map((w) => ({ symbol: w.contractSymbol, weight: w.weight })),
            prices,
          );
          indexes.push({ ...value, commodityCode: code, basis, capturedAt, tradeDate });
        } catch (error) {
          failures.push(`${basis} ${errorMessage(error)}`);
        }
      }

      await store.save(
        quotes.map((q) => ({ ...q, capturedAt, tradeDate })),
        indexes,
      );
      log(`[intraday ${code} ${tradeDate}] ${quotes.length} quotes, ${indexes.length} indexes`);
      if (alert) {
        try {
          await alert({
            commodityCode: code,
            tradeDate,
            detectedAt: capturedAt,
            now: ctx.now,
            ruleBases: [...weights.keys()],
            indexes,
          });
        } catch (error) {
          failures.push(`alert ${errorMessage(error)}`);
        }
      }
      if (failures.length > 0) throw new Error(failures.join('; '));
    });
  }
}

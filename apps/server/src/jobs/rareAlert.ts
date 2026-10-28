// 장중 rare 레벨 알림 판정·발송(product.md 6, D-006, D-022, D-023, D-026, D-069, D-071).
// INTRADAY가 원자재마다 잠정 지수를 저장한 뒤 판정을 부른다. RETRY 재발송은 INTRADAY·DEFERRED_PUSH 중
// 먼저 도는 배치가 한다(product.md 6). HELD 지연 발송은 DEFERRED_PUSH가 한다.
import {
  rareLevelPush,
  type Basis,
  type CommodityCode,
  type Direction,
  type MaPeriod,
  type Settings,
  type Window,
} from '@futureetp/shared';
import {
  isQuietTime,
  planDeferred,
  planDetections,
  planRetries,
  statusAfterSend,
  type AlertLevelRecord,
} from '../calc/alert.ts';
import type { AlertStatus } from '../constants.ts';
import { broadcast, delivered, type PushDeviceStore } from '../push/broadcast.ts';
import type { PushSender } from '../push/sender.ts';
import type { IndexSnapshotRow } from './intraday.ts';

// 중복 방지 키(D-006)에서 방향·레벨을 뺀 판정 조건
export type AlertCondition = {
  commodityCode: CommodityCode;
  basis: Basis;
  maPeriod: MaPeriod;
  window: Window;
  tradeDate: string;
};

export type NewAlertRecord = AlertCondition & {
  direction: Direction;
  rareLevel: number;
  status: AlertStatus;
  disparity: number;
  detectedAt: Date;
};

// 발송을 기다리는(RETRY·HELD) 기록 한 행
export type PendingAlert = AlertCondition & {
  id: string;
  direction: Direction;
  rareLevel: number;
  disparity: number;
  detectedAt: Date;
};

export interface RareAlertStore {
  settings(): Promise<Settings>;
  // 정정 확인(SETTLE_REVISION)의 마지막 실행이 실패면 판정을 멈춘다(D-071)
  isSuspended(): Promise<boolean>;
  // 오름차순 이격도 분포. 없으면 null
  distribution(
    commodityCode: CommodityCode,
    basis: Basis,
    maPeriod: MaPeriod,
    window: Window,
  ): Promise<number[] | null>;
  records(condition: AlertCondition): Promise<AlertLevelRecord[]>;
  // 중복 방지 키가 이미 있는 행은 건너뛴다. 실제로 넣은 행만 돌려준다
  insert(
    rows: readonly NewAlertRecord[],
  ): Promise<{ id: string; direction: Direction; rareLevel: number }[]>;
  updateStatus(id: string, status: AlertStatus, sentAt: Date | null): Promise<void>;
  // 그 시각 전(미만)에 감지한 RETRY 기록. 지금 배치 슬롯에서 첫 발송 중인 행은 빼려고 슬롯 시각을 넘긴다
  retries(before: Date): Promise<PendingAlert[]>;
  // HELD 기록 전부(거래일 무관)
  held(): Promise<PendingAlert[]>;
}

export type RareAlertDeps = {
  store: RareAlertStore;
  devices: PushDeviceStore;
  sender: PushSender;
  log?: (message: string) => void;
};

export type RareAlertInput = {
  commodityCode: CommodityCode;
  tradeDate: string;
  // 판정 시각(배치 슬롯). 푸시 본문의 시각이다
  detectedAt: Date;
  // 거부 시간 판정 시각(실제 실행 시각)
  now: Date;
  // roll_rule이 있는 기준값. 설정 기준값이 없으면 대표월물로 판정한다(product.md 기준값이 없는 원자재)
  ruleBases: readonly Basis[];
  indexes: readonly IndexSnapshotRow[];
};

const isQuietNow = (settings: Settings, now: Date) =>
  isQuietTime(
    now,
    settings.timezone,
    settings.quietTime?.startMin ?? null,
    settings.quietTime?.endMin ?? null,
  );

type SendKind = { isRetry: boolean; deferred: boolean };

// 모든 기기로 보내고 결과로 상태를 바꾼다. 모두 실패면 첫 발송(지연 발송 포함)은 RETRY, 재시도는 FAILED(D-023)
function createSend({ store, devices, sender, log = console.log }: RareAlertDeps) {
  return async (settings: Settings, row: PendingAlert, now: Date, kind: SendKind) => {
    const code = row.commodityCode;
    const result = await broadcast(
      { store: devices, sender },
      {
        text: rareLevelPush(settings.locale, settings.timezone, {
          commodity: code,
          basis: row.basis,
          direction: row.direction,
          level: row.rareLevel,
          disparity: row.disparity,
          maPeriod: row.maPeriod,
          detectedAt: row.detectedAt,
          deferred: kind.deferred,
        }),
        channel: 'alerts',
        data: { type: 'RARE_LEVEL', commodity: code },
      },
    );
    const status = statusAfterSend(delivered(result), kind.isRetry);
    await store.updateStatus(row.id, status, status === 'SENT' ? now : null);
    if (status !== 'SENT') {
      log(
        `[alert ${code}] ${status}: not delivered to ${result.devices} device(s): ${result.failures.join('; ')}`,
      );
    }
  };
}

// 보낼 행은 RETRY로 먼저 넣어 키를 차지한 뒤 보낸다. 발송 중 죽어도 다음 재시도 대상이 된다(D-023)
export function createRareAlert(deps: RareAlertDeps) {
  const { store, log = console.log } = deps;
  const send = createSend(deps);
  return async (input: RareAlertInput): Promise<void> => {
    const { commodityCode: code, tradeDate, detectedAt } = input;
    const settings = await store.settings();
    if (settings.alertCommodity !== code) return;
    if (await store.isSuspended()) {
      log(`[alert ${code}] suspended: last SETTLE_REVISION failed`);
      return;
    }
    const basis =
      settings.basis === 'FRONT' || input.ruleBases.includes(settings.basis)
        ? settings.basis
        : 'FRONT';
    const { maPeriod, window } = settings;
    const index = input.indexes.find((i) => i.basis === basis);
    const sorted = index && (await store.distribution(code, basis, maPeriod, window));
    if (!index || !sorted || sorted.length === 0) {
      log(`[alert ${code} ${basis}] skipped: no ${index ? 'distribution' : 'index'}`);
      return;
    }
    const condition: AlertCondition = { commodityCode: code, basis, maPeriod, window, tradeDate };
    const disparity = index.disparityByMa[`${maPeriod}`];
    const quiet = isQuietNow(settings, input.now);
    const detections = planDetections({
      sorted,
      levels: settings.rareLevels,
      highDisparity: disparity.high,
      lowDisparity: disparity.low,
      existing: await store.records(condition),
      quiet,
    });
    if (detections.length === 0) return;

    const inserted = await store.insert(
      detections.map((d) => ({
        ...condition,
        direction: d.direction,
        rareLevel: d.rareLevel,
        status: d.action === 'SEND' ? 'RETRY' : d.action,
        disparity: d.disparity,
        detectedAt,
      })),
    );
    for (const d of detections) {
      const row = inserted.find((r) => r.direction === d.direction && r.rareLevel === d.rareLevel);
      log(`[alert ${code} ${basis}] ${d.direction} ${d.rareLevel}% ${d.action}`);
      if (d.action !== 'SEND' || row === undefined) continue;
      await send(settings, { ...condition, ...d, id: row.id, detectedAt }, input.now, {
        isRetry: false,
        deferred: false,
      });
    }
  };
}

export type RareAlert = ReturnType<typeof createRareAlert>;

// RETRY 기록을 1회 다시 보낸다. 더 드문 레벨이 덮었으면 SUPPRESSED, 거부 시간이면 RETRY로 두고 기다린다(D-023, D-069).
// 이미 판정한 알림이라 판정 중지(D-071)·알림 원자재 변경과 상관없이 처리한다
export function createAlertRetry(deps: RareAlertDeps) {
  const { store, log = console.log } = deps;
  const send = createSend(deps);
  return async ({ before, now }: { before: Date; now: Date }): Promise<void> => {
    const retries = await store.retries(before);
    if (retries.length === 0) return;
    const settings = await store.settings();
    const quiet = isQuietNow(settings, now);
    const conditions = new Map<string, AlertCondition>();
    for (const { commodityCode, basis, maPeriod, window, tradeDate } of retries) {
      const condition = { commodityCode, basis, maPeriod, window, tradeDate };
      conditions.set(JSON.stringify(condition), condition);
    }
    const existing = (
      await Promise.all(
        [...conditions.values()].map(async (c) =>
          (await store.records(c)).map((r) => ({ ...c, ...r })),
        ),
      )
    ).flat();
    for (const { id, action } of planRetries(retries, existing, quiet)) {
      const row = retries.find((r) => r.id === id)!;
      log(
        `[alert retry ${row.commodityCode} ${row.basis}] ${row.direction} ${row.rareLevel}% ${action}`,
      );
      if (action === 'SUPPRESSED') await store.updateStatus(id, 'SUPPRESSED', null);
      if (action === 'SEND') await send(settings, row, now, { isRetry: true, deferred: false });
    }
  };
}

export type AlertRetry = ReturnType<typeof createAlertRetry>;

// 거부 시간이 끝나면 HELD를 원자재·방향별 가장 드문 1건만 지연 발송하고 나머지는 SUPPRESSED로 바꾼다(product.md 6, D-069).
// 보류 중 거래일이 바뀌었거나 알림 원자재·판정 중지가 바뀌었어도 보낸다. 실패하면 첫 발송처럼 RETRY가 된다
export function createDeferredAlert(deps: RareAlertDeps) {
  const { store, log = console.log } = deps;
  const send = createSend(deps);
  return async ({ now }: { now: Date }): Promise<void> => {
    const held = await store.held();
    if (held.length === 0) return;
    const settings = await store.settings();
    for (const { id, action } of planDeferred(held, isQuietNow(settings, now))) {
      const row = held.find((r) => r.id === id)!;
      log(
        `[alert deferred ${row.commodityCode} ${row.basis}] ${row.direction} ${row.rareLevel}% ${action}`,
      );
      if (action === 'SUPPRESSED') await store.updateStatus(id, 'SUPPRESSED', null);
      if (action === 'SEND') await send(settings, row, now, { isRetry: false, deferred: true });
    }
  };
}

export type DeferredAlert = ReturnType<typeof createDeferredAlert>;

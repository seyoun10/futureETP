// 장중 rare 레벨 알림 판정·발송(product.md 6, D-006, D-022, D-023, D-026, D-069, D-071).
// INTRADAY가 원자재마다 잠정 지수를 저장한 뒤 부른다. RETRY 재발송과 HELD 지연 발송은 따로 처리한다.
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
  planDetections,
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

// 보낼 행은 RETRY로 먼저 넣어 키를 차지한 뒤 보낸다. 발송 중 죽어도 다음 재시도 대상이 된다(D-023)
export function createRareAlert({ store, devices, sender, log = console.log }: RareAlertDeps) {
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
    const quiet = isQuietTime(
      input.now,
      settings.timezone,
      settings.quietTime?.startMin ?? null,
      settings.quietTime?.endMin ?? null,
    );
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
      const result = await broadcast(
        { store: devices, sender },
        {
          text: rareLevelPush(settings.locale, settings.timezone, {
            commodity: code,
            basis,
            direction: d.direction,
            level: d.rareLevel,
            disparity: d.disparity,
            maPeriod,
            detectedAt,
            deferred: false,
          }),
          channel: 'alerts',
          data: { type: 'RARE_LEVEL', commodity: code },
        },
      );
      const status = statusAfterSend(delivered(result), false);
      await store.updateStatus(row.id, status, status === 'SENT' ? input.now : null);
      if (status !== 'SENT') {
        log(
          `[alert ${code}] not delivered to ${result.devices} device(s): ${result.failures.join('; ')}`,
        );
      }
    }
  };
}

export type RareAlert = ReturnType<typeof createRareAlert>;

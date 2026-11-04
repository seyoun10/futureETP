// 장중 rare 레벨 알림 판정 조회·기록(D-069). 흐름은 jobs/rareAlert.ts
import { and, eq, isNotNull, lt, type SQL } from 'drizzle-orm';
import type { AlertDevice, RareAlertStore } from '../jobs/rareAlert.ts';
import type { db as Db } from './client.ts';
import { alertRecord, device, disparityDistribution } from './schema.ts';
import { isAlertJudgmentSuspended } from './settle.ts';
import { toSettings } from './settingsStore.ts';

export function createRareAlertStore(db: typeof Db): RareAlertStore {
  return {
    alertDevices: (code) => alertDevices(eq(device.alertCommodity, code)),
    device: async (id) => (await alertDevices(eq(device.id, id)))[0] ?? null,
    isSuspended: () => isAlertJudgmentSuspended(db),
    async distribution(code, basis, maPeriod, window) {
      const [row] = await db
        .select({ sortedValues: disparityDistribution.sortedValues })
        .from(disparityDistribution)
        .where(
          and(
            eq(disparityDistribution.commodityCode, code),
            eq(disparityDistribution.basis, basis),
            eq(disparityDistribution.maPeriod, maPeriod),
            eq(disparityDistribution.window, window),
          ),
        );
      return row?.sortedValues ?? null;
    },
    records: ({ deviceId, commodityCode, basis, maPeriod, window, tradeDate }) =>
      db
        .select({
          direction: alertRecord.direction,
          rareLevel: alertRecord.rareLevel,
          status: alertRecord.status,
        })
        .from(alertRecord)
        .where(
          and(
            eq(alertRecord.deviceId, deviceId),
            eq(alertRecord.commodityCode, commodityCode),
            eq(alertRecord.basis, basis),
            eq(alertRecord.maPeriod, maPeriod),
            eq(alertRecord.window, window),
            eq(alertRecord.tradeDate, tradeDate),
          ),
        ),
    insert: (rows) =>
      rows.length === 0
        ? Promise.resolve([])
        : db
            .insert(alertRecord)
            .values([...rows])
            .onConflictDoNothing({
              target: [
                alertRecord.deviceId,
                alertRecord.commodityCode,
                alertRecord.basis,
                alertRecord.maPeriod,
                alertRecord.window,
                alertRecord.direction,
                alertRecord.rareLevel,
                alertRecord.tradeDate,
              ],
            })
            .returning({
              id: alertRecord.id,
              direction: alertRecord.direction,
              rareLevel: alertRecord.rareLevel,
            }),
    async updateStatus(id, status, sentAt) {
      await db.update(alertRecord).set({ status, sentAt }).where(eq(alertRecord.id, id));
    },
    retries: (before) =>
      pending(and(eq(alertRecord.status, 'RETRY'), lt(alertRecord.detectedAt, before))),
    held: () => pending(eq(alertRecord.status, 'HELD')),
  };

  // 토큰이 있는 기기만. 토큰이 있으면 플랫폼도 있다(CHECK device_push_platform)
  async function alertDevices(where: SQL): Promise<AlertDevice[]> {
    const rows = await db
      .select()
      .from(device)
      .where(and(where, isNotNull(device.pushToken)))
      .orderBy(device.updatedAt);
    return rows.flatMap((row) =>
      row.platform !== null && row.pushToken !== null
        ? [
            {
              id: row.id,
              platform: row.platform,
              pushToken: row.pushToken,
              locale: row.locale,
              settings: toSettings(row),
            },
          ]
        : [],
    );
  }

  function pending(where: SQL | undefined) {
    return db
      .select({
        id: alertRecord.id,
        deviceId: alertRecord.deviceId,
        commodityCode: alertRecord.commodityCode,
        basis: alertRecord.basis,
        maPeriod: alertRecord.maPeriod,
        window: alertRecord.window,
        tradeDate: alertRecord.tradeDate,
        direction: alertRecord.direction,
        rareLevel: alertRecord.rareLevel,
        disparity: alertRecord.disparity,
        detectedAt: alertRecord.detectedAt,
      })
      .from(alertRecord)
      .where(where)
      .orderBy(alertRecord.detectedAt);
  }
}

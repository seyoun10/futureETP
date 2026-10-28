// 장중 rare 레벨 알림 판정 조회·기록(D-069). 흐름은 jobs/rareAlert.ts
import { and, eq, lt, type SQL } from 'drizzle-orm';
import type { RareAlertStore } from '../jobs/rareAlert.ts';
import type { db as Db } from './client.ts';
import { alertRecord, disparityDistribution } from './schema.ts';
import { isAlertJudgmentSuspended } from './settle.ts';
import { createSettingsStore } from './settingsStore.ts';

export function createRareAlertStore(db: typeof Db): RareAlertStore {
  return {
    settings: createSettingsStore(db).get,
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
    records: ({ commodityCode, basis, maPeriod, window, tradeDate }) =>
      db
        .select({
          direction: alertRecord.direction,
          rareLevel: alertRecord.rareLevel,
          status: alertRecord.status,
        })
        .from(alertRecord)
        .where(
          and(
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

  function pending(where: SQL | undefined) {
    return db
      .select({
        id: alertRecord.id,
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

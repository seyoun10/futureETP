import type { Settings } from '@futureetp/shared';
import { eq } from 'drizzle-orm';
import type { SettingsStore } from '../api/settings.ts';
import type { db as Db } from './client.ts';
import { appSettings } from './schema.ts';

type Row = typeof appSettings.$inferSelect;

// 단일 행(id=1)은 마이그레이션 0001이 만든다(D-058). 거부 시간 두 컬럼은 API에서 quietTime 하나로 묶는다(D-081).
function toSettings(row: Row | undefined): Settings {
  if (!row) throw new Error('app_settings row (id=1) is missing');
  return {
    locale: row.locale,
    timezone: row.timezone,
    basis: row.basis,
    maPeriod: row.maPeriod,
    window: row.window,
    rareLevels: row.rareLevels,
    alertCommodity: row.alertCommodity,
    quietTime:
      row.quietStartMin === null || row.quietEndMin === null
        ? null
        : { startMin: row.quietStartMin, endMin: row.quietEndMin },
  };
}

export function createSettingsStore(db: typeof Db): SettingsStore {
  return {
    async get() {
      const [row] = await db.select().from(appSettings).where(eq(appSettings.id, 1));
      return toSettings(row);
    },
    async update({ quietTime, ...fields }) {
      const [row] = await db
        .update(appSettings)
        .set({
          ...fields,
          ...(quietTime !== undefined && {
            quietStartMin: quietTime?.startMin ?? null,
            quietEndMin: quietTime?.endMin ?? null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(appSettings.id, 1))
        .returning();
      return toSettings(row);
    },
  };
}

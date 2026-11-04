import type { Settings } from '@futureetp/shared';
import { eq } from 'drizzle-orm';
import type { SettingsStore } from '../api/settings.ts';
import type { db as Db } from './client.ts';
import { device } from './schema.ts';

type Row = typeof device.$inferSelect;

// 거부 시간 두 컬럼은 API에서 quietTime 하나로 묶는다(D-081).
export function toSettings(row: Row): Settings {
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

// 기기별 설정(D-120). 처음 보인 기기는 컬럼 기본값으로 행을 만든다.
export function createSettingsStore(db: typeof Db): SettingsStore {
  return {
    async get(deviceId) {
      await db.insert(device).values({ id: deviceId }).onConflictDoNothing();
      const [row] = await db.select().from(device).where(eq(device.id, deviceId));
      if (!row) throw new Error(`device row ${deviceId} is missing`);
      return toSettings(row);
    },
    async update(deviceId, { quietTime, ...fields }) {
      const set = {
        ...fields,
        ...(quietTime !== undefined && {
          quietStartMin: quietTime?.startMin ?? null,
          quietEndMin: quietTime?.endMin ?? null,
        }),
        updatedAt: new Date(),
      };
      const [row] = await db
        .insert(device)
        .values({ id: deviceId, ...set })
        .onConflictDoUpdate({ target: device.id, set })
        .returning();
      return toSettings(row);
    },
  };
}

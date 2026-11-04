import { DISPARITY_SETTINGS_DEFAULTS } from '@futureetp/shared';
import type { Settings } from '@futureetp/shared';
import { desc, eq, isNotNull } from 'drizzle-orm';
import type { SettingsStore } from '../api/settings.ts';
import type { db as Db } from './client.ts';
import { device } from './schema.ts';

type Row = typeof device.$inferSelect;

// 거부 시간 두 컬럼은 API에서 quietTime 하나로 묶는다(D-081).
function toSettings(row: Row): Settings {
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

// 토큰 있는 기기가 없을 때. alertCommodity가 null이라 rare 레벨 판정을 하지 않는다.
const NO_DEVICE_SETTINGS: Settings = {
  locale: 'ko',
  timezone: 'Asia/Seoul',
  ...DISPARITY_SETTINGS_DEFAULTS,
  rareLevels: [...DISPARITY_SETTINGS_DEFAULTS.rareLevels],
  alertCommodity: null,
  quietTime: null,
};

// 알림 작업용: 토큰이 있는 기기 중 가장 최근에 갱신된 기기의 설정.
// D-120 기기별 판정(TODO 5-8 알림)으로 바꾸기 전까지 옛 단일 설정 자리를 대신한다.
export async function latestPushDeviceSettings(db: typeof Db): Promise<Settings> {
  const [row] = await db
    .select()
    .from(device)
    .where(isNotNull(device.pushToken))
    .orderBy(desc(device.updatedAt))
    .limit(1);
  return row ? toSettings(row) : NO_DEVICE_SETTINGS;
}

import { and, eq, isNotNull, ne } from 'drizzle-orm';
import type { DevicesStore } from '../api/devices.ts';
import type { PushDeviceStore } from '../push/broadcast.ts';
import type { db as Db } from './client.ts';
import { device } from './schema.ts';

export function createDevicesStore(db: typeof Db): DevicesStore {
  return {
    // 토큰은 유니크라, 재설치 전 기기 행 등 다른 행의 같은 토큰을 먼저 비운다(D-120).
    upsert: (id, { pushToken, platform, appVersion }) =>
      db.transaction(async (tx) => {
        if (pushToken !== null) {
          await tx
            .update(device)
            .set({ pushToken: null, updatedAt: new Date() })
            .where(and(eq(device.pushToken, pushToken), ne(device.id, id)));
        }
        const set = { pushToken, platform, appVersion, updatedAt: new Date() };
        const [row] = await tx
          .insert(device)
          .values({ id, ...set })
          .onConflictDoUpdate({ target: device.id, set })
          .returning({ id: device.id });
        return row;
      }),
  };
}

// 발송 대상 조회와 무효 토큰 비우기(D-023, D-120)
export function createPushDeviceStore(db: typeof Db): PushDeviceStore {
  return {
    async list() {
      const rows = await db
        .select({
          id: device.id,
          platform: device.platform,
          pushToken: device.pushToken,
          locale: device.locale,
        })
        .from(device)
        .where(isNotNull(device.pushToken))
        .orderBy(device.updatedAt);
      // 토큰이 있으면 플랫폼도 있다(CHECK device_push_platform)
      return rows.flatMap(({ id, platform, pushToken, locale }) =>
        platform !== null && pushToken !== null ? [{ id, platform, pushToken, locale }] : [],
      );
    },
    async clearToken(id) {
      await db.update(device).set({ pushToken: null }).where(eq(device.id, id));
    },
  };
}

import { eq } from 'drizzle-orm';
import type { DevicesStore } from '../api/devices.ts';
import type { PushDeviceStore } from '../push/broadcast.ts';
import type { db as Db } from './client.ts';
import { device } from './schema.ts';

export function createDevicesStore(db: typeof Db): DevicesStore {
  return {
    async upsert({ pushToken, platform, appVersion }) {
      const updatedAt = new Date();
      const [row] = await db
        .insert(device)
        .values({ pushToken, platform, appVersion, updatedAt })
        .onConflictDoUpdate({ target: device.pushToken, set: { platform, appVersion, updatedAt } })
        .returning({ id: device.id });
      return row;
    },
  };
}

// 발송 대상 조회와 무효 토큰 기기 삭제(D-023)
export function createPushDeviceStore(db: typeof Db): PushDeviceStore {
  return {
    list() {
      return db
        .select({ id: device.id, platform: device.platform, pushToken: device.pushToken })
        .from(device)
        .orderBy(device.updatedAt);
    },
    async remove(id) {
      await db.delete(device).where(eq(device.id, id));
    },
  };
}

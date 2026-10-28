import type { DevicesStore } from '../api/devices.ts';
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

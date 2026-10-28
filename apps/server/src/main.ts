import { serve } from '@hono/node-server';
import { createApp } from './api/app.ts';
import { config } from './config.ts';
import { db, pingDb } from './db/client.ts';
import { createCommoditiesStore } from './db/commoditiesStore.ts';
import { createContractsStore } from './db/contractsStore.ts';
import { createCurveStore } from './db/curveStore.ts';
import { createDevicesStore } from './db/devicesStore.ts';
import { createDisparityStore } from './db/disparityStore.ts';
import { createSettingsStore } from './db/settingsStore.ts';
import { createBatchRunStore } from './jobs/batchRunStore.ts';
import { JOB_HANDLERS } from './jobs/handlers.ts';
import { startScheduler } from './jobs/scheduler.ts';

const app = createApp({
  token: config.API_TOKEN,
  checkDb: pingDb,
  settings: createSettingsStore(db),
  commodities: createCommoditiesStore(db),
  disparity: createDisparityStore(db),
  curve: createCurveStore(db),
  contracts: createContractsStore(db),
  devices: createDevicesStore(db),
});

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(
    `futureETP server: port ${info.port}, scheduler ${config.SCHEDULER_ENABLED ? 'on' : 'off'}`,
  );
});

if (config.SCHEDULER_ENABLED) {
  await startScheduler({ handlers: JOB_HANDLERS, store: createBatchRunStore(db) });
}

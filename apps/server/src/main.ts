import { serve } from '@hono/node-server';
import { createApp } from './api/app.ts';
import { config } from './config.ts';

const app = createApp({ token: config.API_TOKEN });

serve({ fetch: app.fetch, port: config.PORT }, (info) => {
  console.log(
    `futureETP server: port ${info.port}, scheduler ${config.SCHEDULER_ENABLED ? 'on' : 'off'}`,
  );
});

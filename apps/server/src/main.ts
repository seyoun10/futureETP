import { config } from './config.ts';

console.log(`futureETP server: port ${config.PORT}, scheduler ${config.SCHEDULER_ENABLED ? 'on' : 'off'}`);

// 작업 1회 실행(D-043, D-060). 재시도하지 않는다. 실패하면 종료 코드 1.
import { db } from '../db/client.ts';
import { parseJobArgs } from './args.ts';
import { createBatchRunStore } from './batchRunStore.ts';
import { JOB_HANDLERS } from './handlers.ts';
import { runJob } from './runner.ts';

async function main(): Promise<number> {
  const { job, asOf } = parseJobArgs(process.argv.slice(2));
  const handler = JOB_HANDLERS[job];
  if (!handler) throw new Error(`Job not implemented: ${job}`);

  const result = await runJob(job, handler, {
    store: createBatchRunStore(db),
    maxAttempts: 1,
    retryDelayMs: 0,
    asOf,
  });
  console.log(`[job ${job}] ${result.status} (batch_run ${result.runId})`);
  return result.status === 'SUCCESS' ? 0 : 1;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await db.$client.end();
}

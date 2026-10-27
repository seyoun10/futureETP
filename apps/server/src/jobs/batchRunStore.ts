import { eq } from 'drizzle-orm';
import type { db as Db } from '../db/client.ts';
import { batchRun } from '../db/schema.ts';
import type { BatchRunStore } from './runner.ts';

export function createBatchRunStore(db: typeof Db): BatchRunStore {
  return {
    async start(run) {
      const [row] = await db
        .insert(batchRun)
        .values({ ...run, status: 'RUNNING' })
        .returning({ id: batchRun.id });
      return row.id;
    },
    async finish(id, result) {
      await db.update(batchRun).set(result).where(eq(batchRun.id, id));
    },
    async failInterrupted(finishedAt) {
      const rows = await db
        .update(batchRun)
        .set({ status: 'FAILED', finishedAt, error: 'Interrupted by server restart' })
        .where(eq(batchRun.status, 'RUNNING'))
        .returning({ id: batchRun.id });
      return rows.length;
    },
  };
}

import { and, desc, eq, gt, isNotNull, sql } from 'drizzle-orm';
import type { db as Db } from '../db/client.ts';
import { batchRun } from '../db/schema.ts';
import type { OpsAlertStore } from './opsAlert.ts';
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

export function createOpsAlertStore(db: typeof Db): OpsAlertStore {
  return {
    async alreadyNotified(runId) {
      const [run] = await db
        .select({ job: batchRun.job, tradeDate: batchRun.tradeDate })
        .from(batchRun)
        .where(eq(batchRun.id, runId));
      if (!run) throw new Error(`batch_run not found: ${runId}`);
      const [notified] = await db
        .select({ startedAt: batchRun.startedAt })
        .from(batchRun)
        .where(
          and(
            eq(batchRun.job, run.job),
            sql`${batchRun.tradeDate} is not distinct from ${run.tradeDate}`,
            isNotNull(batchRun.opsNotifiedAt),
          ),
        )
        .orderBy(desc(batchRun.startedAt))
        .limit(1);
      if (!notified) return false;
      const [succeeded] = await db
        .select({ id: batchRun.id })
        .from(batchRun)
        .where(
          and(
            eq(batchRun.job, run.job),
            eq(batchRun.status, 'SUCCESS'),
            gt(batchRun.startedAt, notified.startedAt),
          ),
        )
        .limit(1);
      return !succeeded;
    },
    async markNotified(runId, at) {
      await db.update(batchRun).set({ opsNotifiedAt: at }).where(eq(batchRun.id, runId));
    },
  };
}

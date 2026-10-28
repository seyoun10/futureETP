// BACKUP 작업이 덤프 뒤에 지우는 보관 기간 지난 행(D-046). 흐름은 jobs/backup.ts
import { lt } from 'drizzle-orm';
import type { RetentionStore } from '../jobs/backup.ts';
import type { db as Db } from './client.ts';
import { alertRecord, batchRun, indexSnapshot, intradaySnapshot } from './schema.ts';

export function createRetentionStore(db: typeof Db): RetentionStore {
  return {
    prune: ({ snapshotsBefore, recordsBefore }) =>
      db.transaction(async (tx) => ({
        intraday_snapshot: (
          await tx.delete(intradaySnapshot).where(lt(intradaySnapshot.capturedAt, snapshotsBefore))
        ).rowCount,
        index_snapshot: (
          await tx.delete(indexSnapshot).where(lt(indexSnapshot.capturedAt, snapshotsBefore))
        ).rowCount,
        alert_record: (
          await tx.delete(alertRecord).where(lt(alertRecord.detectedAt, recordsBefore))
        ).rowCount,
        batch_run: (await tx.delete(batchRun).where(lt(batchRun.startedAt, recordsBefore)))
          .rowCount,
      })),
  };
}

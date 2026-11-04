// 백업 BACKUP(D-045, D-046). 매일 16:30 CT에 pg_dump 덤프를 만들고 최근 7개만 둔 뒤 보관 기간이 지난 행을 지운다.
// 지우기 전 덤프가 있어야 하므로 덤프가 실패하면 지우지 않는다. 처리 거래일이 없어 ctx.tradeDate는 채우지 않는다.
import { DAY_MS } from '../calc/tradingCalendar.ts';
import type { JobHandler } from './runner.ts';

export const BACKUP_KEEP = 7;
export const SNAPSHOT_RETENTION_DAYS = 90;
export const RECORD_RETENTION_DAYS = 365;

const DUMP_FILE = /^futureetp-\d{8}T\d{6}Z\.dump$/;

export interface BackupTarget {
  // 덤프 파일을 다 쓴 뒤에만 이 이름으로 보이게 한다
  dump(fileName: string): Promise<void>;
  list(): Promise<string[]>;
  remove(fileName: string): Promise<void>;
}

export type PruneCutoffs = {
  // intraday_snapshot·index_snapshot captured_at
  snapshotsBefore: Date;
  // alert_record detected_at, batch_run started_at
  recordsBefore: Date;
};

export interface RetentionStore {
  prune(cutoffs: PruneCutoffs): Promise<Record<string, number | null>>;
}

// 2026-10-28T21:30:00.123Z → futureetp-20261028T213000Z.dump (이름순 = 시간순)
export function dumpFileName(at: Date): string {
  const stamp = at
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  return `futureetp-${stamp}.dump`;
}

// 덤프 이름 형식인 파일만 보고, 최근 keep개를 뺀 나머지
export function dumpsToRemove(fileNames: readonly string[], keep = BACKUP_KEEP): string[] {
  const dumps = fileNames.filter((name) => DUMP_FILE.test(name)).sort();
  return dumps.slice(0, Math.max(0, dumps.length - keep));
}

export function pruneCutoffs(now: Date): PruneCutoffs {
  return {
    snapshotsBefore: new Date(now.getTime() - SNAPSHOT_RETENTION_DAYS * DAY_MS),
    recordsBefore: new Date(now.getTime() - RECORD_RETENTION_DAYS * DAY_MS),
  };
}

export function createBackupHandler({
  target,
  retention,
  log = console.log,
}: {
  // BACKUP_DIR이 없으면 null(작업 실패)
  target: BackupTarget | null;
  retention: RetentionStore;
  log?: (message: string) => void;
}): JobHandler {
  return async (ctx) => {
    if (!target) throw new Error('BACKUP_DIR is not set');
    const fileName = dumpFileName(ctx.now);
    await target.dump(fileName);
    const removed = dumpsToRemove(await target.list());
    for (const name of removed) await target.remove(name);
    log(`[backup] ${fileName} (removed ${removed.length} old dump(s))`);

    const cutoffs = pruneCutoffs(ctx.now);
    const deleted = await retention.prune(cutoffs);
    log(`[backup] pruned ${JSON.stringify(deleted)}`);
  };
}

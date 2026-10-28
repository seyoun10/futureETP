import { describe, expect, it, vi } from 'vitest';
import {
  createBackupHandler,
  dumpFileName,
  dumpsToRemove,
  pruneCutoffs,
  type BackupTarget,
  type RetentionStore,
} from './backup.ts';

const NOW = new Date('2026-10-28T21:30:00.123Z');
const dump = (day: number) => `futureetp-202610${String(day).padStart(2, '0')}T213000Z.dump`;

describe('dumpFileName', () => {
  it('UTC 초 단위 이름이라 이름순이 시간순이다', () => {
    expect(dumpFileName(NOW)).toBe('futureetp-20261028T213000Z.dump');
  });
});

describe('dumpsToRemove', () => {
  it('최근 7개를 두고 오래된 것만 고른다', () => {
    const names = [10, 11, 12, 13, 14, 15, 16, 17, 18].map(dump).reverse();
    expect(dumpsToRemove(names)).toEqual([dump(10), dump(11)]);
  });

  it('덤프 이름 형식이 아닌 파일(덜 쓴 덤프 등)은 건드리지 않는다', () => {
    const names = [...[10, 11, 12, 13, 14, 15, 16].map(dump), `${dump(17)}.partial`, 'notes.txt'];
    expect(dumpsToRemove(names)).toEqual([]);
  });
});

describe('pruneCutoffs', () => {
  it('스냅숏은 90일, 알림·실행 기록은 365일 전', () => {
    expect(pruneCutoffs(NOW)).toEqual({
      snapshotsBefore: new Date('2026-07-30T21:30:00.123Z'),
      recordsBefore: new Date('2025-10-28T21:30:00.123Z'),
    });
  });
});

function setup(files: string[], dumpError?: Error) {
  const order: string[] = [];
  const target: BackupTarget = {
    dump: (name) => {
      order.push(`dump ${name}`);
      if (dumpError) return Promise.reject(dumpError);
      files.push(name);
      return Promise.resolve();
    },
    list: () => Promise.resolve([...files]),
    remove: (name) => {
      order.push(`remove ${name}`);
      return Promise.resolve();
    },
  };
  const prune = vi.fn<RetentionStore['prune']>(() => {
    order.push('prune');
    return Promise.resolve({ intraday_snapshot: 3 });
  });
  return { target, retention: { prune }, prune, order };
}

describe('createBackupHandler', () => {
  it('덤프 → 오래된 덤프 삭제 → 보관 기간 행 정리 순서로 한다', async () => {
    const { target, retention, prune, order } = setup([20, 21, 22, 23, 24, 25, 26].map(dump));
    const handler = createBackupHandler({ target, retention, log: vi.fn() });

    await handler({ now: NOW });

    expect(order).toEqual([`dump ${dump(28)}`, `remove ${dump(20)}`, 'prune']);
    expect(prune).toHaveBeenCalledWith(pruneCutoffs(NOW));
  });

  it('덤프가 실패하면 덤프도 행도 지우지 않는다', async () => {
    const { target, retention, order } = setup(
      [20, 21, 22, 23, 24, 25, 26].map(dump),
      new Error('pg_dump failed'),
    );
    const handler = createBackupHandler({ target, retention, log: vi.fn() });

    await expect(handler({ now: NOW })).rejects.toThrow('pg_dump failed');
    expect(order).toEqual([`dump ${dump(28)}`]);
  });

  it('BACKUP_DIR이 없으면 실패한다', async () => {
    const { retention, prune } = setup([]);
    const handler = createBackupHandler({ target: null, retention, log: vi.fn() });

    await expect(handler({ now: NOW })).rejects.toThrow('BACKUP_DIR is not set');
    expect(prune).not.toHaveBeenCalled();
  });
});

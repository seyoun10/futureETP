// BACKUP 작업의 덤프 폴더(D-045). 흐름은 jobs/backup.ts
// pg_dump -Fc로 임시 이름에 쓴 뒤 이름을 바꿔, 덜 쓴 덤프가 보관 개수 계산·내려받기에 끼지 않게 한다.
import { execFile } from 'node:child_process';
import { readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { BackupTarget } from '../jobs/backup.ts';

const run = promisify(execFile);

export function createPgDumpTarget({
  dir,
  databaseUrl,
}: {
  dir: string;
  databaseUrl: string;
}): BackupTarget {
  return {
    async dump(fileName) {
      const path = join(dir, fileName);
      const partial = `${path}.partial`;
      try {
        await run('pg_dump', ['-Fc', '--file', partial, '--dbname', databaseUrl]);
        await rename(partial, path);
      } catch (error) {
        await rm(partial, { force: true });
        // execFile 오류 메시지에는 접속 문자열(비밀번호)이 든 명령줄이 들어가므로 stderr만 남긴다
        const stderr = (error as { stderr?: string }).stderr?.trim();
        throw new Error(`pg_dump failed${stderr ? `: ${stderr}` : ''}`);
      }
    },
    list: () => readdir(dir),
    async remove(fileName) {
      await rm(join(dir, fileName));
    },
  };
}

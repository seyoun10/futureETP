// DB 통합 테스트(*.db.test.ts) 공용 도구. 테이블을 비우므로 이름이 _test로 끝나는 DB에서만 돈다.
import { sql } from 'drizzle-orm';
import type { db as Db } from './client.ts';

// 마이그레이션이 넣는 시드 테이블(drizzle/0002~0003). 비우지 않는다
const SEED_TABLES = ['commodity', 'active_month_rule', 'roll_rule'];

export function assertTestDatabaseName(name: string): void {
  if (!name.endsWith('_test')) {
    throw new Error(`Refusing to touch database "${name}": its name must end with _test`);
  }
}

export async function resetDb(db: typeof Db): Promise<void> {
  const { rows: current } = await db.execute<{ name: string }>(
    sql`select current_database() as name`,
  );
  assertTestDatabaseName(current[0]?.name ?? '');

  const { rows } = await db.execute<{ name: string }>(
    sql`select tablename as name from pg_tables where schemaname = 'public'`,
  );
  const tables = rows.map((r) => r.name).filter((name) => !SEED_TABLES.includes(name));
  await db.execute(sql.raw(`truncate ${tables.map((t) => `"${t}"`).join(', ')} cascade`));

  // 시드 행 안에서 테스트가 바꿀 수 있는 값을 되돌린다
  await db.execute(sql`update commodity set recompute_pending_at = null`);
}

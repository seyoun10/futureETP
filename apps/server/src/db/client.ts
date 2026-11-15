import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

// Postgres가 멈춰도 요청·배치가 끝없이 기다리지 않게 한다. 가장 긴 문장(원자재 전체 재계산의 삭제·삽입)도
// 몇 초라 2분이면 넉넉하다. 연결을 못 얻으면 10초에 실패한다
export const DB_STATEMENT_TIMEOUT_MS = 120_000;
export const DB_CONNECT_TIMEOUT_MS = 10_000;

export const db = drizzle({
  connection: {
    connectionString: config.DATABASE_URL,
    statement_timeout: DB_STATEMENT_TIMEOUT_MS,
    connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
  },
  schema,
  casing: 'snake_case',
});

// health 확인용(D-059). 연결·쿼리가 실패하면 throw한다.
export async function pingDb(): Promise<void> {
  await db.execute(sql`select 1`);
}

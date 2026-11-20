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

// 유휴 연결이 끊기면(DB 재시작·pg_terminate_backend) 풀이 'error'를 낸다. 리스너가 없으면 처리되지 않은 이벤트로
// 프로세스가 끝나 진행 중 배치를 잃는다. 끊긴 연결은 풀이 버리고 다음 요청이 새로 연결하므로 로그만 남긴다
db.$client.on('error', (error) => console.error('pg idle client error', error));

// health 확인용(D-059). 연결·쿼리가 실패하면 throw한다.
export async function pingDb(): Promise<void> {
  await db.execute(sql`select 1`);
}

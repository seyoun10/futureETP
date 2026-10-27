import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

export const db = drizzle(config.DATABASE_URL, { schema, casing: 'snake_case' });

// health 확인용(D-059). 연결·쿼리가 실패하면 throw한다.
export async function pingDb(): Promise<void> {
  await db.execute(sql`select 1`);
}

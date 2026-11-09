// DB 통합 테스트 실행마다 테스트 DB를 새로 만들고 마이그레이션 전체를 적용한다.
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import type { TestProject } from 'vitest/node';
import { assertTestDatabaseName } from './testDb.ts';

async function recreateTestDatabase(url: string): Promise<void> {
  const name = new URL(url).pathname.slice(1);
  assertTestDatabaseName(name);

  const maintenance = new URL(url);
  maintenance.pathname = '/postgres';
  const admin = new pg.Client({ connectionString: maintenance.href });
  await admin.connect();
  try {
    await admin.query(`drop database if exists "${name}" with (force)`);
    await admin.query(`create database "${name}"`);
  } finally {
    await admin.end();
  }

  const db = drizzle(url);
  try {
    await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
  } finally {
    await db.$client.end();
  }
}

export async function setup(project: TestProject): Promise<void> {
  const url = project.config.env.DATABASE_URL;
  if (url === undefined) throw new Error('DATABASE_URL is missing from the db test project');
  try {
    await recreateTestDatabase(url);
  } catch (error) {
    // globalSetup 오류는 Vitest가 소스맵을 읽다 원인을 잃으므로 먼저 찍는다
    console.error('DB test setup failed:', error);
    throw error;
  }
}

// 마이그레이션 적용 1회 실행(D-053). 서버 시작 때는 하지 않는다(D-048).
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db } from './client.ts';

await migrate(db, { migrationsFolder: new URL('../../drizzle', import.meta.url).pathname });
await db.$client.end();
console.log('Migrations applied');

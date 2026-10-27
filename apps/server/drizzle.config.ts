import { defineConfig } from 'drizzle-kit';

// drizzle-kit은 dev에서 마이그레이션 SQL 생성(generate)에만 쓴다. 적용은 src/db/migrate.ts(D-053).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
});

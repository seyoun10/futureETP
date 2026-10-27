import { drizzle } from 'drizzle-orm/node-postgres';
import { config } from '../config.ts';
import * as schema from './schema.ts';

export const db = drizzle(config.DATABASE_URL, { schema, casing: 'snake_case' });

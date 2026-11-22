import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
  var _pglite: PGlite | undefined;
}

const databaseUrl = process.env.DATABASE_URL?.trim();
const hasSqlConfig = Boolean(process.env.SQL_HOST && process.env.SQL_DB_NAME);

if (!databaseUrl && !hasSqlConfig) {
  global._pglite ??= new PGlite();
  const migrationPath = path.resolve(process.cwd(), 'drizzle', '0000_wooden_karma.sql');
  if (fs.existsSync(migrationPath)) {
    await global._pglite.exec(fs.readFileSync(migrationPath, 'utf8'));
  }
  console.log('Using embedded PGlite database for local development.');
}

export const createPool = () => {
  if (!global._postgresPool) {
    const poolConfig = databaseUrl
      ? {
          connectionString: databaseUrl,
          ssl: process.env.SQL_SSL === 'true' || databaseUrl.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : undefined,
        }
      : {
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
        };

    global._postgresPool = new Pool({
      ...poolConfig,
      max: 10,
      connectionTimeoutMillis: 15000,
    });
  }
  return global._postgresPool;
};

export const db = (global._pglite
  ? drizzlePglite(global._pglite, { schema })
  : drizzlePg(createPool(), { schema })) as ReturnType<typeof drizzlePg>;

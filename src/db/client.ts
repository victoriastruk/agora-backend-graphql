import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { env } from '@/shared/config/env';
import { logger } from '@/utils/logger';
import * as schema from './schema';

let client: postgres.Sql;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

const getDbInstance = (): PostgresJsDatabase<typeof schema> => {
  if (!dbInstance) {
    client = postgres(env.DATABASE_URL, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });

    dbInstance = drizzle(client, { schema });
  }
  return dbInstance;
};

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    return getDbInstance()[prop as keyof PostgresJsDatabase<typeof schema>];
  },
});

export const closeDbConnection = async (): Promise<void> => {
  if (!client) return;
  try {
    await client.end();
    logger.info('Database connection closed gracefully');
  } catch (error) {
    logger.error('Error closing database connection:', error as Error);
    process.exit(1);
  }
};
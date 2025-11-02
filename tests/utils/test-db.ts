import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/db/schema';
import { eq } from 'drizzle-orm';

let client: postgres.Sql;
let db: PostgresJsDatabase<typeof schema> | null = null;

export const setupTestDb = async () => {
  const host = 'localhost';
  const port = '5432';
  const user = 'postgres';
  const password = 'pass';
  const dbName = 'reddit-server';

  const dbUrl = `postgresql://${user}:${password}@${host}:${port}/${dbName}`;
  client = postgres(dbUrl, {
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => {}, // Suppress PostgreSQL notices in tests
  });

  db = drizzle(client, { schema }) as PostgresJsDatabase<typeof schema>;

  await client`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`;

  await client`CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  )`;

  return db;
};

export const teardownTestDb = async () => {
  if (client) {
    try {
      await client.end({ timeout: 5 });
    } catch (error) {
      // Suppress error logging in tests
      if (process.env.NODE_ENV !== 'test') {
        console.error('Error during teardown:', error);
      }
    }
  }
};

export const clearTestDb = async () => {
  if (!db) return;

  try {
    await db.delete(schema.sessions);
    await db.delete(schema.users);
  } catch (error) {
    if (error instanceof Error && !error.message.includes('CONNECTION_ENDED')) {
      throw error;
    }
  }
};

export const createTestUser = async (userData: {
  username: string;
  email: string;
  passwordHash: string;
}) => {
  if (!db) throw new Error('Test database not initialized');

  const result = await db.insert(schema.users).values(userData).returning();

  return result[0];
};

export const getTestUser = async (id: number) => {
  if (!db) throw new Error('Test database not initialized');

  const result = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);

  return result[0] || null;
};

export const getAllTestUsers = async () => {
  if (!db) throw new Error('Test database not initialized');

  return await db.select().from(schema.users);
};

export { db };

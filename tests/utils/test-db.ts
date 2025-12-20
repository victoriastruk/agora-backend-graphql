import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";
import { setDbInstance } from "@/db/client";

let client: postgres.Sql | null = null;
let db: PostgresJsDatabase<typeof schema> | null = null;

const getTestDatabaseUrl = (): string => {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }

  return "postgresql://postgres:pass@localhost:5432/reddit-server";
};

export const setupTestDb = async (): Promise<PostgresJsDatabase<typeof schema>> => {
  const dbUrl = getTestDatabaseUrl();

  try {
    client = postgres(dbUrl, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      onnotice: () => {},
    });

    await client`SELECT 1`;

    db = drizzle(client, { schema }) as PostgresJsDatabase<typeof schema>;

    setDbInstance(db);

    await client`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        bio TEXT,
        avatar_url TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `.catch(() => {});

    await client`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `.catch(() => {});

    return db;
  } catch (error) {
    console.error("Failed to setup test database:", error);
    throw new Error(
      `Failed to connect to test database. Please ensure PostgreSQL is running.\n` +
        `Connection string: ${dbUrl.replace(/:[^:@]+@/, ":****@")}\n` +
        `Try running: docker compose up -d`
    );
  }
};

export const teardownTestDb = async (): Promise<void> => {
  if (client) {
    try {
      await client.end({ timeout: 5 });
      client = null;
      db = null;
    } catch (error: any) {
      if (process.env.NODE_ENV !== "test") {
        console.error("Error during database teardown:", error);
      }
    }
  }
};

export const clearTestDb = async (): Promise<void> => {
  if (!db || !client) return;

  try {
    await db.delete(schema.sessions).catch(() => {});
    await db.delete(schema.communityMembers).catch(() => {});
    await db.delete(schema.communities).catch(() => {});
    await db.delete(schema.users).catch(() => {});
  } catch (error) {
    if (error instanceof Error && !error.message.includes("CONNECTION_ENDED")) {
      if (!error.message.includes("connection")) {
        throw error;
      }
    }
  }
};

export const createTestUser = async (userData: {
  username: string;
  email: string;
  passwordHash: string;
}) => {
  if (!db) throw new Error("Test database not initialized");

  const result = await db
    .insert(schema.users)
    .values({
      username: userData.username,
      email: userData.email,
      passwordHash: userData.passwordHash,
    })
    .returning();

  return result[0];
};

export const getTestUser = async (id: number) => {
  if (!db) throw new Error("Test database not initialized");

  const result = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);

  return result[0] || null;
};

export const getAllTestUsers = async () => {
  if (!db) throw new Error("Test database not initialized");

  return db.select().from(schema.users);
};

export const createTestSession = async (sessionData: {
  id: string;
  userId: number;
  expiresAt: Date;
}) => {
  if (!db) throw new Error("Test database not initialized");

  const result = await db
    .insert(schema.sessions)
    .values({
      id: sessionData.id,
      userId: sessionData.userId,
      expiresAt: sessionData.expiresAt,
    })
    .returning();

  return result[0];
};

export const createTestCommunity = async (communityData: {
  name: string;
  displayName: string;
  description?: string;
  iconUrl?: string;
  bannerUrl?: string;
  memberCount?: number;
}) => {
  if (!db) throw new Error("Test database not initialized");

  const result = await db
    .insert(schema.communities)
    .values({
      name: communityData.name,
      displayName: communityData.displayName,
      description: communityData.description,
      iconUrl: communityData.iconUrl,
      bannerUrl: communityData.bannerUrl,
      memberCount: communityData.memberCount,
    })
    .returning();

  return result[0];
};

export { db };

import { drizzle } from "drizzle-orm/postgres-js";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/shared/config/env";
import * as schema from "./schema";

let client: postgres.Sql;
let dbInstance: PostgresJsDatabase<typeof schema> | null = null;

export const setDbInstance = (instance: PostgresJsDatabase<typeof schema>) => {
  dbInstance = instance;
};

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
  try {
    await client.end();
    console.log("Database connection closed gracefully");
  } catch (error) {
    console.error("Error closing database connection:", error);
    process.exit(1);
  }
};

process.on("SIGINT", closeDbConnection);
process.on("SIGTERM", closeDbConnection);

import Redis from "ioredis";
import { env } from "@/shared/config/env";

export const redis = new Redis(env.REDIS_URL);

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit();
    console.log("Redis connection closed gracefully");
  } catch (error) {
    console.error("Error closing Redis connection:", error);
  }
};

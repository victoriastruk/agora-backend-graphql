import Redis from 'ioredis';
import { logger } from '@/utils/logger';
import { env } from '@/shared/config/env';

let redisInstance: Redis | null = null;

const getRedis = (): Redis => {
  if (!redisInstance) {
    redisInstance = new Redis(env.REDIS_URL);
    redisInstance.on('error', err =>
      logger.error('Redis connection error', err),
    );
    redisInstance.on('connect', () => logger.info('Connected to Redis'));
  }
  return redisInstance;
};

export const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    return getRedis()[prop as keyof Redis];
  },
});

export const closeRedisConnection = async (): Promise<void> => {
  try {
    await redis.quit();
    logger.info('Redis connection closed gracefully');
  } catch (error) {
    logger.error('Error closing Redis connection', error as Error);
    process.exit(1);
  }
};
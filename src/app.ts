import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { env } from '@/shared/config/env';
import { closeDbConnection } from '@/db/client';
import { closeRedisConnection } from '@/db/redis';
import { errorPlugin } from '@/plugins/error';
import { yogaPlugin } from '@/plugins/yoga';
import { authController } from '@/controllers/auth.controller';
import { googleAuthController } from '@/controllers/googleAuth.controller';
import { createRequestLogger } from '@/plugins/request-logger';
import { logger } from '@/utils/logger';

export const app = new Elysia()
  .use(cors({ origin: env.CORS_ORIGIN, maxAge: 86400 }))
  .use(errorPlugin)
  .use(createRequestLogger({ logger }))
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))
  .get('/', () => ({
    message: 'Agora Backend API',
    version: '1.0.0',
    graphql: '/graphql',
  }))
  .use(authController)
  .use(googleAuthController)
  .use(yogaPlugin)
  .onStop(async () => {
    logger.logServerShutdown();
    await closeDbConnection();
    await closeRedisConnection();
  });

app.listen(env.PORT, () => {
  logger.logServerStart(env.PORT);
});

process.on('SIGINT', () => app.stop());
process.on('SIGTERM', () => app.stop());

import { Elysia } from 'elysia';
import { env } from '@/shared/config/env';
import { closeDbConnection } from '@/db/client';
import { closeRedisConnection } from '@/db/redis';
import { corsPlugin } from '@/plugins/cors';
import { openapi } from '@elysiajs/openapi';
import { yogaPlugin } from '@/plugins/yoga';
import { errorPlugin } from '@/plugins/error';
import { createRequestLogger } from '@/plugins/request-logger';
import { routes } from '@/routes';
import { authController } from '@/controllers/auth.controller';
import { healthRoutes } from '@/routes/health';
import { logger } from '@/utils/logger';
import { AppConfig } from '@/types/app';
import { openApiPlugin } from './plugins/openapi';

class Application {
  private readonly config: AppConfig;

  constructor(config: AppConfig) {
    this.config = config;
  }

  public createApp(): Elysia {
    const requestLogger = createRequestLogger({ logger: this.config.logger });

    const app = new Elysia();

    app
      .use(requestLogger)
      .use(errorPlugin)
      .use(corsPlugin)
      .use(openapi())
      .use(openApiPlugin)
      .use(yogaPlugin)
      .use(healthRoutes)
      .use(authController)
      .use(routes[0])
      .onStop(() => {
        this.config.logger.logServerShutdown();
        closeDbConnection();
        closeRedisConnection();
      });

    return app;
  }

  public start(): void {
    const app = this.createApp();

    app.listen(this.config.port, () => {
      this.config.logger.logServerStart(this.config.port);
    });
  }
}

const appConfig: AppConfig = {
  port: env.PORT,
  logger,
};

const application = new Application(appConfig);
application.start();

export { Application };
export const app = application.createApp();

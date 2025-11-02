import { Elysia } from 'elysia';
import { corsPlugin } from '@/plugins/cors';
import { swaggerPlugin } from '@/plugins/swagger';
import { yogaPlugin } from '@/plugins/yoga';
import { errorPlugin } from '@/plugins/error';
import { createRequestLogger } from '@/plugins/request-logger';
import { routes } from '@/routes';
import { authController } from '@/controllers/auth.controller';
import { healthRoutes } from '@/routes/health';
import { logger } from '@/utils/logger';
import { AppConfig } from '@/types/app';
import { setDbInstance } from '@/db/client';
import { db as getTestDb } from './test-db';

export const createTestApp = (config?: Partial<AppConfig>): Elysia => {
  const appConfig: AppConfig = {
    port: config?.port || 4001,
    logger: config?.logger || logger,
    ...config,
  };

  const testDb = getTestDb;
  if (testDb) {
    setDbInstance(testDb);
  }

  const requestLogger = createRequestLogger({ logger: appConfig.logger });
  const app = new Elysia();

  app
    .use(requestLogger)
    .use(errorPlugin)
    .use(corsPlugin)
    .use(swaggerPlugin)
    .use(yogaPlugin)
    .use(healthRoutes)
    .use(authController)
    .use(routes[0]);

  return app;
};

export const testUtils = {
  createAgent: (app: Elysia) => {
    return {
      get: (path: string) =>
        app.handle(new Request(`http://localhost${path}`, { method: 'GET' })),
      post: (path: string, body?: any) =>
        app.handle(
          new Request(`http://localhost${path}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          })
        ),
      put: (path: string, body?: any) =>
        app.handle(
          new Request(`http://localhost${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : undefined,
          })
        ),
      delete: (path: string) =>
        app.handle(
          new Request(`http://localhost${path}`, { method: 'DELETE' })
        ),
    };
  },

  parseResponse: async (response: Response) => {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  },

  generateTestUser: (overrides = {}) => ({
    username: `testuser_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    email: `test${Date.now()}@example.com`,
    passwordHash: 'hashed_password_123',
    ...overrides,
  }),

  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export const mockTemplates = {
  redis: () => ({
    setex: vi?.fn() || (() => {}),
    get: vi?.fn() || (() => {}),
    del: vi?.fn() || (() => {}),
    expire: vi?.fn() || (() => {}),
  }),
};

export const testLifecycle = {
  beforeAll: () => {
    process.env.NODE_ENV = 'test';
  },

  afterAll: () => {
    if (typeof vi !== 'undefined') {
      vi.restoreAllMocks();
    }
  },

  beforeEach: () => {
    if (typeof vi !== 'undefined') {
      vi.clearAllMocks();
    }
  },
};

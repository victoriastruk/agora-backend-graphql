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

  try {
    const testDb = getTestDb;
    if (testDb) {
      setDbInstance(testDb as any);
    }
  } catch {
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
    const baseUrl = 'http://localhost';

    return {
      get: async (path: string, options?: RequestInit) => {
        return app.handle(new Request(`${baseUrl}${path}`, {
          method: 'GET',
          ...options,
        }));
      },

      post: async (path: string, body?: any, options?: RequestInit) => {
        return app.handle(new Request(`${baseUrl}${path}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        }));
      },

      put: async (path: string, body?: any, options?: RequestInit) => {
        return app.handle(new Request(`${baseUrl}${path}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        }));
      },

      delete: async (path: string, options?: RequestInit) => {
        return app.handle(new Request(`${baseUrl}${path}`, {
          method: 'DELETE',
          ...options,
        }));
      },

      patch: async (path: string, body?: any, options?: RequestInit) => {
        return app.handle(new Request(`${baseUrl}${path}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: body ? JSON.stringify(body) : undefined,
          ...options,
        }));
      },
    };
  },

  parseResponse: async (response: Response): Promise<any> => {
    const contentType = response.headers.get('content-type');
    const text = await response.text();
    
    if (contentType?.includes('application/json')) {
      try {
        return JSON.parse(text);
      } catch {
        return text;
      }
    }
    
    return text;
  },

  generateTestUser: (overrides = {}) => ({
    username: `testuser_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    email: `test${Date.now()}@example.com`,
    password: 'TestPassword123!',
    ...overrides,
  }),

  wait: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  getCookie: (response: Response, cookieName: string): string | null => {
    const setCookie = response.headers.get('set-cookie');
    if (!setCookie) return null;

    const cookies = setCookie.split(',').map(c => c.trim());
    const cookie = cookies.find(c => c.startsWith(`${cookieName}=`));
    
    if (!cookie) return null;
    
    return cookie.split(';')[0].split('=')[1] || null;
  },
};

export const mockTemplates = {
  redis: () => ({
    setex: () => Promise.resolve('OK'),
    get: () => Promise.resolve(null),
    del: () => Promise.resolve(1),
    expire: () => Promise.resolve(1),
  }),
};

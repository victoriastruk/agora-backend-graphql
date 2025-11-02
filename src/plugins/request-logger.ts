import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import { Logger, asyncLocalStorage } from '@/utils/logger';

const INTERNAL_ELYSIA_DOMAIN = 'ely.sia';
const DEFAULT_IP = 'unknown';
const SUCCESS_STATUS_THRESHOLD = 400;

export interface RequestLoggerConfig {
  logger: Logger;
}

export const createRequestLogger = ({ logger }: RequestLoggerConfig) => {
  return new Elysia()
    .onRequest((ctx) => {
      if (ctx.request.url.includes(INTERNAL_ELYSIA_DOMAIN)) {
        return;
      }

      const requestId = randomUUID();
      const startTime = process.hrtime.bigint();

      const store = new Map();
      store.set('requestId', requestId);
      store.set('method', ctx.request.method);
      store.set('url', ctx.request.url);
      store.set('startTime', startTime);
      store.set('ip', getClientIP(ctx.request));

      (ctx.store as any).requestStore = store;

      asyncLocalStorage.run(store, () => {
        logger.info('Request started', {
          method: ctx.request.method,
          url: ctx.request.url,
          userAgent: ctx.request.headers.get('user-agent'),
        });
      });
    })
    .onAfterResponse((ctx) => {
      if (ctx.request.url.includes(INTERNAL_ELYSIA_DOMAIN)) {
        return;
      }

      const store = (ctx.store as any).requestStore as Map<string, any>;
      const startTime = store?.get('startTime');

      if (startTime) {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1e6;
        const statusCode = getStatusCode(ctx.set.status);

        const logData = {
          method: store?.get('method'),
          url: store?.get('url'),
          statusCode,
          responseTime: duration,
          userAgent: ctx.request.headers.get('user-agent'),
          ip: store?.get('ip'),
        };

        if (statusCode >= SUCCESS_STATUS_THRESHOLD) {
          logger.warn('Request completed with error', logData);
        } else {
          logger.info('Request completed', logData);
        }
      }
    });
};

const getClientIP = (request: Request): string => {
  return (
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    DEFAULT_IP
  );
};

const getStatusCode = (status: number | string | undefined): number => {
  return typeof status === 'number' ? status : 200;
};

import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';
import { type Logger, runWithStore } from '@/utils/logger';

const INTERNAL_ELYSIA_DOMAIN = 'ely.sia';
const DEFAULT_IP = 'unknown';
const ERROR_STATUS_THRESHOLD = 400;

export interface RequestLoggerConfig {
  logger: Logger;
}

export const createRequestLogger = ({ logger }: RequestLoggerConfig) => {
  return new Elysia()
    .onRequest(ctx => {
      if (ctx.request.url.includes(INTERNAL_ELYSIA_DOMAIN)) return;

      const requestId = randomUUID();
      const startTime = process.hrtime.bigint();

      const store = new Map<string, unknown>([
        ['requestId', requestId],
        ['method', ctx.request.method],
        ['url', ctx.request.url],
        ['startTime', startTime],
        ['ip', getClientIP(ctx.request)],
      ]);

      (ctx.store as Record<string, unknown>).requestStore = store;

      runWithStore(store, () => {
        logger.info('Request started', {
          method: ctx.request.method,
          url: ctx.request.url,
          userAgent: ctx.request.headers.get('user-agent') ?? undefined,
        });
      });
    })
    .onAfterResponse(ctx => {
      if (ctx.request.url.includes(INTERNAL_ELYSIA_DOMAIN)) return;

      const store = (ctx.store as Record<string, unknown>).requestStore as
        | Map<string, unknown>
        | undefined;

      const startTime = store?.get('startTime') as bigint | undefined;
      if (!startTime) return;

      const duration = Number(process.hrtime.bigint() - startTime) / 1e6;
      const statusCode = getStatusCode(ctx.set.status);

      const logData = {
        method: store?.get('method'),
        url: store?.get('url'),
        statusCode,
        responseTime: duration,
        userAgent: ctx.request.headers.get('user-agent') ?? undefined,
        ip: store?.get('ip'),
      };

      if (statusCode >= ERROR_STATUS_THRESHOLD) {
        logger.warn('Request completed with error', logData);
      } else {
        logger.info('Request completed', logData);
      }
    });
};

const getClientIP = (request: Request): string =>
  request.headers.get('x-forwarded-for') ||
  request.headers.get('x-real-ip') ||
  request.headers.get('cf-connecting-ip') ||
  DEFAULT_IP;

const getStatusCode = (status: number | string | undefined): number =>
  typeof status === 'number' ? status : 200;

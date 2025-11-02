import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';
import { env } from '@/shared/config/env';

const createLoggerConfig = () => {
  const isDevelopment = env.NODE_ENV === 'development';

  return {
    level: isDevelopment ? 'debug' : 'info',
    formatters: {
      level: (label: string) => ({ level: label }),
      log: (obj: any) => {
        const requestId = getRequestId();
        if (requestId) {
          obj.requestId = requestId;
        }
        return obj;
      },
    },
    serializers: {
      error: pino.stdSerializers.err,
      req: pino.stdSerializers.req,
      res: pino.stdSerializers.res,
    },
    ...(isDevelopment && {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          messageFormat: '{level} {msg}',
        },
      },
    }),
  };
};

const baseLogger = pino(createLoggerConfig());

const asyncLocalStorage = new AsyncLocalStorage<Map<string, any>>();

function getRequestId(): string | undefined {
  const store = asyncLocalStorage.getStore();
  return store?.get('requestId');
}

interface RequestContext {
  requestId: string;
  method?: string;
  url?: string;
  userId?: string;
  ip?: string;
}

export class Logger {
  private logger: pino.Logger;

  constructor(module?: string) {
    this.logger = module ? baseLogger.child({ module }) : baseLogger;
  }

  child(bindings: Record<string, any>): Logger {
    return new Logger().setLogger(this.logger.child(bindings));
  }

  private setLogger(logger: pino.Logger): Logger {
    const newLogger = new Logger();
    newLogger.logger = logger;
    return newLogger;
  }

  startRequest(context: RequestContext): { run: <T>(fn: () => T) => T } {
    const store = new Map();
    store.set('requestId', context.requestId);
    store.set('method', context.method);
    store.set('url', context.url);
    store.set('userId', context.userId);
    store.set('ip', context.ip);

    return {
      run: <T>(fn: () => T): T => {
        return asyncLocalStorage.run(store, () => {
          this.info('Request started', {
            method: context.method,
            url: context.url,
            userId: context.userId,
            ip: context.ip,
          });
          return fn();
        });
      },
    };
  }

  info(message: string, data?: any): void {
    this.logger.info(data || {}, message);
  }

  warn(message: string, data?: any): void {
    this.logger.warn(data || {}, message);
  }

  error(message: string, error?: Error | any): void {
    const logData =
      error instanceof Error
        ? { error: pino.stdSerializers.err(error) }
        : { error };

    this.logger.error(logData, message);
  }

  debug(message: string, data?: any): void {
    this.logger.debug(data || {}, message);
  }

  time(label: string): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1e6;
      this.info(`${label} completed`, { duration: `${duration.toFixed(2)}ms` });
    };
  }

  logRequest(req: any, res: any, responseTime?: number): void {
    const logData = {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: responseTime ? `${responseTime}ms` : undefined,
      userAgent: req.headers['user-agent'],
      ip: req.ip || req.connection?.remoteAddress,
    };

    if (res.statusCode >= 400) {
      this.warn('Request completed with error', logData);
    } else {
      this.info('Request completed', logData);
    }
  }

  logDatabase(
    operation: string,
    table: string,
    duration?: number,
    error?: any
  ): void {
    const logData = {
      operation,
      table,
      duration: duration ? `${duration}ms` : undefined,
    };

    if (error) {
      this.error(`Database ${operation} failed`, { ...logData, error });
    } else {
      this.debug(`Database ${operation}`, logData);
    }
  }

  logServerStart(port: number, host: string = 'localhost'): void {
    this.info('🚀 Server starting...', { port, host });
    this.info(`📍 Server: http://${host}:${port}`);
    this.info(`📚 API Docs: http://${host}:${port}/docs`);
    this.info(`🔗 GraphQL: http://${host}:${port}/graphql`);
    this.info(`❤️ Health: http://${host}:${port}/health`);
  }

  logServerShutdown(): void {
    this.info('Server is shutting down...');
  }
}

export const logger = new Logger();

export { asyncLocalStorage };

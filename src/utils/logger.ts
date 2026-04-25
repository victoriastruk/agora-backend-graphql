import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';
import { env } from '@/shared/config/env';

type LogData = Record<string, unknown>;

const isDevelopment = env.NODE_ENV === 'development';

const baseLogger = pino({
  level: isDevelopment ? 'debug' : 'info',
  formatters: {
    level: (label: string) => ({ level: label }),
    log: (obj: LogData) => {
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
});

const asyncLocalStorage = new AsyncLocalStorage<Map<string, unknown>>();

function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.get('requestId') as string | undefined;
}
export const runWithStore = <T>(
  store: Map<string, unknown>,
  fn: () => T,
): T => {
  return asyncLocalStorage.run(store, fn);
};

export class Logger {
  private logger: pino.Logger;

  constructor(module?: string) {
    this.logger = module ? baseLogger.child({ module }) : baseLogger;
  }

  child(bindings: Record<string, unknown>): Logger {
    const instance = Object.create(Logger.prototype) as Logger;
    instance.logger = this.logger.child(bindings);
    return instance;
  }

  info(message: string, data?: LogData): void {
    this.logger.info(data ?? {}, message);
  }

  warn(message: string, data?: LogData): void {
    this.logger.warn(data ?? {}, message);
  }

  error(message: string, error?: Error | unknown): void {
    const logData =
      error instanceof Error
        ? { error: pino.stdSerializers.err(error) }
        : { error };

    this.logger.error(logData, message);
  }

  debug(message: string, data?: LogData): void {
    this.logger.debug(data ?? {}, message);
  }

  time(label: string): () => void {
    const start = process.hrtime.bigint();
    return () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e6;
      this.info(`${label} completed`, { duration: `${duration.toFixed(2)}ms` });
    };
  }

  logServerStart(port: number, host: string = 'localhost'): void {
    this.info('🚀 Server starting...', { port, host });
    this.info(`📍 Server: http://${host}:${port}`);
    this.info(`🔗 GraphQL: http://${host}:${port}/graphql`);
    this.info(`❤️ Health: http://${host}:${port}/health`);
  }

  logServerShutdown(): void {
    this.info('Server is shutting down...');
  }
}

export const logger = new Logger();

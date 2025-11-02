import { Logger, logger } from '@/utils/logger';

// Mock pino to avoid actual logging during tests
vi.mock('pino', () => ({
  default: vi.fn(() => ({
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
  stdSerializers: {
    err: vi.fn((error) => ({ message: error.message, stack: error.stack })),
    req: vi.fn(),
    res: vi.fn(),
  },
}));

// Mock AsyncLocalStorage
vi.mock('async_hooks', () => ({
  AsyncLocalStorage: vi.fn(() => ({
    getStore: vi.fn(),
    run: vi.fn((store, fn) => fn()),
  })),
}));

describe('Logger', () => {
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the singleton logger instance
    mockLogger = {
      child: vi.fn(() => mockLogger),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    };
  });

  describe('Logger instantiation', () => {
    it('should create a logger instance', () => {
      const testLogger = new Logger();
      expect(testLogger).toBeDefined();
      expect(testLogger).toBeInstanceOf(Logger);
    });

    it('should create a logger with module name', () => {
      const testLogger = new Logger('test-module');
      expect(testLogger).toBeDefined();
    });
  });

  describe('Child logger creation', () => {
    it('should create a child logger with bindings', () => {
      const testLogger = new Logger();
      const childLogger = testLogger.child({ module: 'test' });

      expect(childLogger).toBeDefined();
      expect(childLogger).toBeInstanceOf(Logger);
    });
  });

  describe('Request context tracking', () => {
    it('should start a request context and run function', () => {
      const testLogger = new Logger();
      const context = {
        requestId: 'req-123',
        method: 'GET',
        url: '/test',
        userId: 'user-456',
        ip: '127.0.0.1',
      };

      const mockFn = vi.fn(() => 'result');
      const { run } = testLogger.startRequest(context);

      const result = run(mockFn);

      expect(mockFn).toHaveBeenCalled();
      expect(result).toBe('result');
    });
  });

  describe('Logging methods', () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      // Mock the internal logger
      (testLogger as any).logger = mockLogger;
    });

    it('should log info messages', () => {
      testLogger.info('Test info message');

      expect(mockLogger.info).toHaveBeenCalledWith({}, 'Test info message');
    });

    it('should log info messages with data', () => {
      const data = { key: 'value' };
      testLogger.info('Test info message', data);

      expect(mockLogger.info).toHaveBeenCalledWith(data, 'Test info message');
    });

    it('should log warn messages', () => {
      testLogger.warn('Test warn message');

      expect(mockLogger.warn).toHaveBeenCalledWith({}, 'Test warn message');
    });

    it('should log error messages', () => {
      testLogger.error('Test error message');

      expect(mockLogger.error).toHaveBeenCalledWith({ error: undefined }, 'Test error message');
    });

    it('should log error messages with Error object', () => {
      const error = new Error('Test error');
      testLogger.error('Test error message', error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ error: expect.any(Object) }),
        'Test error message'
      );
    });

    it('should log debug messages', () => {
      testLogger.debug('Test debug message');

      expect(mockLogger.debug).toHaveBeenCalledWith({}, 'Test debug message');
    });
  });

  describe('Performance monitoring', () => {
    it('should measure execution time', () => {
      const testLogger = new Logger();
      (testLogger as any).logger = mockLogger;

      const endTimer = testLogger.time('test operation');

      // Simulate some work
      const start = Date.now();
      while (Date.now() - start < 10) {} // Busy wait for ~10ms

      endTimer();

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ duration: expect.stringMatching(/\d+\.\d+ms/) }),
        'test operation completed'
      );
    });
  });

  describe('HTTP request logging', () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      (testLogger as any).logger = mockLogger;
    });

    it('should log successful requests', () => {
      const req = {
        method: 'GET',
        url: '/test',
        headers: { 'user-agent': 'test-agent' },
        ip: '127.0.0.1',
      };
      const res = { statusCode: 200 };

      testLogger.logRequest(req, res, 150);

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: '/test',
          statusCode: 200,
          responseTime: '150ms',
          userAgent: 'test-agent',
          ip: '127.0.0.1',
        }),
        'Request completed'
      );
    });

    it('should log error requests', () => {
      const req = {
        method: 'POST',
        url: '/test',
        headers: {},
      };
      const res = { statusCode: 500 };

      testLogger.logRequest(req, res);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'POST',
          url: '/test',
          statusCode: 500,
        }),
        'Request completed with error'
      );
    });
  });

  describe('Database operation logging', () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      (testLogger as any).logger = mockLogger;
    });

    it('should log successful database operations', () => {
      testLogger.logDatabase('SELECT', 'users', 25);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        {
          operation: 'SELECT',
          table: 'users',
          duration: '25ms',
        },
        'Database SELECT'
      );
    });

    it('should log failed database operations', () => {
      const error = new Error('Connection failed');
      testLogger.logDatabase('INSERT', 'users', 100, error);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(Object),
        'Database INSERT failed'
      );
    });
  });

  describe('Application lifecycle logging', () => {
    let testLogger: Logger;

    beforeEach(() => {
      testLogger = new Logger();
      (testLogger as any).logger = mockLogger;
    });

    it('should log server start', () => {
      testLogger.logServerStart(3000, 'localhost');

      expect(mockLogger.info).toHaveBeenCalledWith({ port: 3000, host: 'localhost' }, '🚀 Server starting...');
      expect(mockLogger.info).toHaveBeenCalledWith({}, '📍 Server: http://localhost:3000');
      expect(mockLogger.info).toHaveBeenCalledWith({}, '📚 API Docs: http://localhost:3000/docs');
      expect(mockLogger.info).toHaveBeenCalledWith({}, '🔗 GraphQL: http://localhost:3000/graphql');
      expect(mockLogger.info).toHaveBeenCalledWith({}, '❤️ Health: http://localhost:3000/health');
    });

    it('should log server shutdown', () => {
      testLogger.logServerShutdown();

      expect(mockLogger.info).toHaveBeenCalledWith({}, 'Server is shutting down...');
    });
  });
});

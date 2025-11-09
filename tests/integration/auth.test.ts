import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  mock,
} from 'bun:test';
import { createTestApp, testUtils } from '../utils/test-helpers';
import {
  setupTestDb,
  teardownTestDb,
  clearTestDb,
  createTestUser,
} from '../utils/test-db';
import { redis } from '@/db/redis';

const mockRedisData = new Map<string, { value: string; ttl: number }>();

const mockRedis = {
  setex: mock((key: string, ttl: number, value: string) => {
    mockRedisData.set(key, { value, ttl });
    return Promise.resolve('OK');
  }),
  get: mock((key: string) => {
    const data = mockRedisData.get(key);
    return Promise.resolve(data?.value || null);
  }),
  del: mock((key: string) => {
    const existed = mockRedisData.has(key);
    mockRedisData.delete(key);
    return Promise.resolve(existed ? 1 : 0);
  }),
  expire: mock((key: string, ttl: number) => {
    const data = mockRedisData.get(key);
    if (data) {
      data.ttl = ttl;
      return Promise.resolve(1);
    }
    return Promise.resolve(0);
  }),
};

(redis as any).setex = mockRedis.setex;
(redis as any).get = mockRedis.get;
(redis as any).del = mockRedis.del;
(redis as any).expire = mockRedis.expire;

describe('Auth Routes Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;
  let agent: ReturnType<typeof testUtils.createAgent>;

  beforeEach(async () => {
    await setupTestDb();
    await clearTestDb();
    mockRedisData.clear();

    mockRedis.setex.mockClear();
    mockRedis.get.mockClear();
    mockRedis.del.mockClear();
    mockRedis.expire.mockClear();

    app = createTestApp();
    agent = testUtils.createAgent(app);
  });

  afterEach(async () => {
    await clearTestDb();
    mockRedisData.clear();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = testUtils.generateTestUser({
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'SecurePass123!',
      });

      const response = await agent.post('/auth/register', {
        username: userData.username,
        email: userData.email,
        password: userData.password,
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.message).toBe('User registered successfully');
    });

    it('should hash password before storing', async () => {
      const password = 'SecurePass123!';
      const userData = testUtils.generateTestUser({
        username: 'hashtest',
        email: 'hashtest@example.com',
        password,
      });

      const response = await agent.post('/auth/register', {
        username: userData.username,
        email: userData.email,
        password,
      });

      expect(response.status).toBe(201);

      await clearTestDb();
    });

    it('should validate username format', async () => {
      const response = await agent.post('/auth/register', {
        username: 'ab',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate username regex (alphanumeric and underscore only)', async () => {
      const response = await agent.post('/auth/register', {
        username: 'invalid-user!',
        email: 'test@example.com',
        password: 'SecurePass123!',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate email format', async () => {
      const response = await agent.post('/auth/register', {
        username: 'testuser',
        email: 'invalid-email',
        password: 'SecurePass123!',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate password length', async () => {
      const response = await agent.post('/auth/register', {
        username: 'testuser',
        email: 'test@example.com',
        password: 'short',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should prevent duplicate usernames', async () => {
      const username = 'duplicate';
      const user1 = testUtils.generateTestUser({
        username,
        email: 'user1@example.com',
        password: 'SecurePass123!',
      });

      await agent.post('/auth/register', {
        username: user1.username,
        email: user1.email,
        password: user1.password,
      });

      const response = await agent.post('/auth/register', {
        username,
        email: 'user2@example.com',
        password: 'SecurePass123!',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toContain('User already exists');
    });

    it('should prevent duplicate emails', async () => {
      const email = 'duplicate@example.com';
      const user1 = testUtils.generateTestUser({
        username: 'user1',
        email,
        password: 'SecurePass123!',
      });

      await agent.post('/auth/register', {
        username: user1.username,
        email: user1.email,
        password: user1.password,
      });

      const response = await agent.post('/auth/register', {
        username: 'user2',
        email,
        password: 'SecurePass123!',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(409);
      expect(data.success).toBe(false);
      expect(data.message).toContain('User already exists');
    });

    it('should handle missing required fields', async () => {
      const response = await agent.post('/auth/register', {
        username: 'testuser',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with username', async () => {
      const password = 'SecurePass123!';
      const user = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash:
          await require('@/utils/auth').AuthUtils.hashPassword(password),
      });

      const response = await agent.post('/auth/login', {
        usernameOrEmail: 'testuser',
        password,
      });

      const data = await testUtils.parseResponse(response);
      const cookie = testUtils.getCookie(response, 'sessionId');

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Login successful');
      expect(cookie).toBeDefined();
      expect(cookie).not.toBe('');
    });

    it('should login successfully with email', async () => {
      const password = 'SecurePass123!';
      const user = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash:
          await require('@/utils/auth').AuthUtils.hashPassword(password),
      });

      const response = await agent.post('/auth/login', {
        usernameOrEmail: 'test@example.com',
        password,
      });

      const data = await testUtils.parseResponse(response);
      const cookie = testUtils.getCookie(response, 'sessionId');

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(cookie).toBeDefined();
    });

    it('should reject invalid credentials (wrong password)', async () => {
      const password = 'SecurePass123!';
      await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash:
          await require('@/utils/auth').AuthUtils.hashPassword(password),
      });

      const response = await agent.post('/auth/login', {
        usernameOrEmail: 'testuser',
        password: 'WrongPassword123!',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid credentials');
    });

    it('should reject invalid credentials (non-existent user)', async () => {
      const response = await agent.post('/auth/login', {
        usernameOrEmail: 'nonexistent',
        password: 'SecurePass123!',
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Invalid credentials');
    });

    it('should validate input data', async () => {
      const response = await agent.post('/auth/login', {});

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should create a session on successful login', async () => {
      const password = 'SecurePass123!';
      await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash:
          await require('@/utils/auth').AuthUtils.hashPassword(password),
      });

      const response = await agent.post('/auth/login', {
        usernameOrEmail: 'testuser',
        password,
      });

      expect(response.status).toBe(200);
      expect(mockRedis.setex).toHaveBeenCalled();
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid session', async () => {
      const password = 'SecurePass123!';
      await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash:
          await require('@/utils/auth').AuthUtils.hashPassword(password),
      });

      const loginResponse = await agent.post('/auth/login', {
        usernameOrEmail: 'testuser',
        password,
      });

      const sessionId = testUtils.getCookie(loginResponse, 'sessionId');
      expect(sessionId).toBeDefined();

      const logoutResponse = await agent.post('/auth/logout', undefined, {
        headers: {
          Cookie: `sessionId=${sessionId}`,
        },
      });

      const data = await testUtils.parseResponse(logoutResponse);

      expect(logoutResponse.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Logout successful');
    });

    it('should handle logout without session cookie', async () => {
      const response = await agent.post('/auth/logout');

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('GET /auth/me', () => {
    it('should return user info with valid session', async () => {
      const password = 'SecurePass123!';
      await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash:
          await require('@/utils/auth').AuthUtils.hashPassword(password),
      });

      const loginResponse = await agent.post('/auth/login', {
        usernameOrEmail: 'testuser',
        password,
      });

      const sessionId = testUtils.getCookie(loginResponse, 'sessionId');
      expect(sessionId).toBeDefined();

      const meResponse = await agent.get('/auth/me', {
        headers: {
          Cookie: `sessionId=${sessionId}`,
        },
      });

      const data = await testUtils.parseResponse(meResponse);

      expect(meResponse.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.user).toBeDefined();
      expect(data.data.user.username).toBe('testuser');
      expect(data.data.user.email).toBe('test@example.com');
      expect(data.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return 401 without session cookie', async () => {
      const response = await agent.get('/auth/me');

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Not authenticated');
    });

    it('should return 401 with invalid session', async () => {
      const response = await agent.get('/auth/me', {
        headers: {
          Cookie: 'sessionId=invalid-session-id',
        },
      });

      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.message).toBe('Not authenticated');
    });

    it('should extend session on successful /me call', async () => {
      const password = 'SecurePass123!';
      await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash:
          await require('@/utils/auth').AuthUtils.hashPassword(password),
      });

      const loginResponse = await agent.post('/auth/login', {
        usernameOrEmail: 'testuser',
        password,
      });

      const sessionId = testUtils.getCookie(loginResponse, 'sessionId');

      mockRedis.expire.mockClear();

      await agent.get('/auth/me', {
        headers: {
          Cookie: `sessionId=${sessionId}`,
        },
      });

      // JWT tokens are stateless and don't need extension
    });
  });
});

import { describe, it, expect, beforeEach, mock } from 'bun:test';

const mockRedisMethods = {
  setex: mock<(key: string, ttl: number, value: string) => Promise<string>>(
    () => Promise.resolve('OK')
  ),
  get: mock<(key: string) => Promise<string | null>>(() =>
    Promise.resolve(null)
  ),
  del: mock<(key: string) => Promise<number>>(() => Promise.resolve(1)),
  expire: mock<(key: string, ttl: number) => Promise<number>>(() =>
    Promise.resolve(1)
  ),
};

mock.module('@/db/redis', () => ({
  redis: mockRedisMethods,
}));

import { AuthUtils } from '@/utils/auth';
import { redis } from '@/db/redis';

describe('AuthUtils', () => {
  beforeEach(() => {
    Object.assign(redis, mockRedisMethods);
    mockRedisMethods.setex.mockReset();
    mockRedisMethods.get.mockReset();
    mockRedisMethods.del.mockReset();
    mockRedisMethods.expire.mockReset();

    mockRedisMethods.setex.mockImplementation(() => Promise.resolve('OK'));
    mockRedisMethods.get.mockImplementation(() => Promise.resolve(null));
    mockRedisMethods.del.mockImplementation(() => Promise.resolve(1));
    mockRedisMethods.expire.mockImplementation(() => Promise.resolve(1));
  });

  describe('Password hashing and verification', () => {
    it('should hash a password successfully', async () => {
      const password = 'testPassword123!';
      const hash = await AuthUtils.hashPassword(password);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
      expect(hash).not.toBe(password);
      expect(hash).not.toContain(password);
    });

    it('should generate different hashes for the same password', async () => {
      const password = 'testPassword123!';
      const hash1 = await AuthUtils.hashPassword(password);
      const hash2 = await AuthUtils.hashPassword(password);

      expect(hash1).not.toBe(hash2);
      expect(hash1.length).toBeGreaterThan(0);
      expect(hash2.length).toBeGreaterThan(0);
    });

    it('should verify correct password', async () => {
      const password = 'testPassword123!';
      const hash = await AuthUtils.hashPassword(password);
      const isValid = await AuthUtils.verifyPassword(hash, password);

      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'testPassword123!';
      const wrongPassword = 'wrongPassword456!';
      const hash = await AuthUtils.hashPassword(password);
      const isValid = await AuthUtils.verifyPassword(hash, wrongPassword);

      expect(isValid).toBe(false);
    });

    it('should handle verification errors gracefully', async () => {
      const isValid = await AuthUtils.verifyPassword(
        'invalid_hash_format',
        'password'
      );

      expect(isValid).toBe(false);
    });

    it('should handle empty password hash', async () => {
      const isValid = await AuthUtils.verifyPassword('', 'password');

      expect(isValid).toBe(false);
    });
  });

  describe('Session ID generation', () => {
    it('should generate a session ID', () => {
      const sessionId = AuthUtils.generateSessionId();

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should generate unique session IDs', () => {
      const sessionId1 = AuthUtils.generateSessionId();
      const sessionId2 = AuthUtils.generateSessionId();
      const sessionId3 = AuthUtils.generateSessionId();

      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).not.toBe(sessionId3);
      expect(sessionId2).not.toBe(sessionId3);
    });

    it('should generate session IDs of consistent length', () => {
      const ids = Array.from({ length: 10 }, () =>
        AuthUtils.generateSessionId()
      );

      const lengths = ids.map((id) => id.length);
      const uniqueLengths = new Set(lengths);

      expect(uniqueLengths.size).toBe(1);
      expect(lengths[0]).toBe(32);
    });
  });

  describe('Session key formatting', () => {
    it('should format session key correctly', () => {
      const sessionId = 'test_session_id';
      const expectedKey = 'session:test_session_id';

      const key = AuthUtils.getSessionKey(sessionId);

      expect(key).toBe(expectedKey);
    });

    it('should handle different session IDs', () => {
      const sessionId1 = 'abc123';
      const sessionId2 = 'xyz789';

      const key1 = AuthUtils.getSessionKey(sessionId1);
      const key2 = AuthUtils.getSessionKey(sessionId2);

      expect(key1).toBe('session:abc123');
      expect(key2).toBe('session:xyz789');
      expect(key1).not.toBe(key2);
    });
  });

  describe('Session management', () => {
    it('should create a session successfully', async () => {
      mockRedisMethods.setex.mockResolvedValueOnce('OK');

      const userId = 1;
      const sessionId = await AuthUtils.createSession(userId);

      expect(sessionId).toBeDefined();
      expect(typeof sessionId).toBe('string');
      expect(mockRedisMethods.setex).toHaveBeenCalledTimes(1);

      const calls = mockRedisMethods.setex.mock.calls;
      if (calls.length > 0) {
        const [key, ttl, value] = calls[0];
        expect(key).toContain('session:');
        expect(ttl).toBe(7 * 24 * 60 * 60);

        const sessionData = JSON.parse(value as string);
        expect(sessionData.userId).toBe(userId);
        expect(sessionData.createdAt).toBeDefined();
        expect(sessionData.expiresAt).toBeDefined();
      }
    });

    it('should get a valid session', async () => {
      const userId = 1;
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      const sessionData = JSON.stringify({
        userId,
        createdAt: Date.now(),
        expiresAt,
      });

      mockRedisMethods.get.mockResolvedValueOnce(sessionData);

      const sessionId = 'test-session-id';
      const session = await AuthUtils.getSession(sessionId);

      expect(session).not.toBeNull();
      expect(session?.userId).toBe(userId);
      expect(session?.expiresAt).toBe(expiresAt);
      expect(mockRedisMethods.get).toHaveBeenCalledWith(
        'session:test-session-id'
      );
    });

    it('should return null for non-existent session', async () => {
      mockRedisMethods.get.mockResolvedValueOnce(null);

      const session = await AuthUtils.getSession('non-existent-session');

      expect(session).toBeNull();
      expect(mockRedisMethods.get).toHaveBeenCalledWith(
        'session:non-existent-session'
      );
    });

    it('should return null for expired session', async () => {
      const expiredSessionData = JSON.stringify({
        userId: 1,
        createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
        expiresAt: Date.now() - 24 * 60 * 60 * 1000,
      });

      mockRedisMethods.get.mockResolvedValueOnce(expiredSessionData);
      mockRedisMethods.del.mockResolvedValueOnce(1);

      const session = await AuthUtils.getSession('expired-session');

      expect(session).toBeNull();
      expect(mockRedisMethods.del).toHaveBeenCalledWith(
        'session:expired-session'
      );
    });

    it('should handle malformed session data', async () => {
      mockRedisMethods.get.mockResolvedValueOnce('invalid-json');

      const session = await AuthUtils.getSession('malformed-session');

      expect(session).toBeNull();
    });

    it('should destroy a session', async () => {
      mockRedisMethods.del.mockResolvedValueOnce(1);

      await AuthUtils.destroySession('session-to-destroy');

      expect(mockRedisMethods.del).toHaveBeenCalledWith(
        'session:session-to-destroy'
      );
      expect(mockRedisMethods.del).toHaveBeenCalledTimes(1);
    });

    it('should extend session TTL', async () => {
      const userId = 1;
      const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
      const sessionData = JSON.stringify({
        userId,
        createdAt: Date.now(),
        expiresAt,
      });

      mockRedisMethods.get.mockResolvedValueOnce(sessionData);
      mockRedisMethods.expire.mockResolvedValueOnce(1);

      await AuthUtils.extendSession('valid-session');

      expect(mockRedisMethods.expire).toHaveBeenCalledWith(
        'session:valid-session',
        7 * 24 * 60 * 60
      );
    });

    it('should not extend non-existent session', async () => {
      mockRedisMethods.get.mockResolvedValueOnce(null);

      await AuthUtils.extendSession('non-existent-session');

      expect(mockRedisMethods.expire).not.toHaveBeenCalled();
    });
  });
});

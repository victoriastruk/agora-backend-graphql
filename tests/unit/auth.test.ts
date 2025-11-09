import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { AuthUtils } from '@/utils/auth';
import { redis } from '@/db/redis';

const mockRedis = {
  setex: mock(async () => 'OK'),
  get: mock(async () => null),
  del: mock(async () => 1),
};
mock.module('@/db/redis', () => ({ redis: mockRedis }));

describe('AuthUtils (JWT version)', () => {
  beforeEach(() => {
    mockRedis.setex.mockReset();
    mockRedis.get.mockReset();
    mockRedis.del.mockReset();
  });

  it('should create access and refresh tokens', async () => {
    const user = { id: 1, username: 'test', email: 'test@example.com' };

    const { tokens, refreshTokenId } = await AuthUtils.createAuthSession(user);

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(refreshTokenId).toBeDefined();
    expect(mockRedis.setex).toHaveBeenCalledTimes(1);
  });

  it('should verify valid access token', async () => {
    const user = { id: 1, username: 'test', email: 'test@example.com' };
    const { tokens } = await AuthUtils.createAuthSession(user);

    const verification = await AuthUtils.verifyAccessToken(tokens.accessToken);

    expect(verification.status).toBe('valid');
    expect(verification.payload?.username).toBe(user.username);
  });

  it('should return invalid for corrupted token', async () => {
    const verification = await AuthUtils.verifyAccessToken('invalid.token');
    expect(verification.status).toBe('invalid');
  });
});

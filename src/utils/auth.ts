import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { redis } from '@/db/redis';

export class AuthUtils {
  private static readonly SESSION_TTL = 7 * 24 * 60 * 60;
  private static readonly SESSION_PREFIX = 'session:';

  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  static async verifyPassword(
    hash: string,
    password: string
  ): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  static generateSessionId(): string {
    return nanoid(32);
  }

  static getSessionKey(sessionId: string): string {
    return `${this.SESSION_PREFIX}${sessionId}`;
  }

  static async createSession(userId: number): Promise<string> {
    const sessionId = this.generateSessionId();
    const sessionKey = this.getSessionKey(sessionId);
    const expiresAt = Date.now() + this.SESSION_TTL * 1000;

    await redis.setex(
      sessionKey,
      this.SESSION_TTL,
      JSON.stringify({
        userId,
        createdAt: Date.now(),
        expiresAt,
      })
    );

    return sessionId;
  }

  static async getSession(
    sessionId: string
  ): Promise<{ userId: number; expiresAt: number } | null> {
    const sessionKey = this.getSessionKey(sessionId);
    const sessionData = await redis.get(sessionKey);

    if (!sessionData) return null;

    try {
      const session = JSON.parse(sessionData);

      if (Date.now() > session.expiresAt) {
        await this.destroySession(sessionId);
        return null;
      }

      return {
        userId: session.userId,
        expiresAt: session.expiresAt,
      };
    } catch {
      return null;
    }
  }

  static async destroySession(sessionId: string): Promise<void> {
    const sessionKey = this.getSessionKey(sessionId);
    await redis.del(sessionKey);
  }

  static async extendSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (!session) return;

    const sessionKey = this.getSessionKey(sessionId);
    await redis.expire(sessionKey, this.SESSION_TTL);
  }
}

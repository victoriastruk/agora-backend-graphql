import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import type {
  CookieStore,
  AccessTokenPayload,
  RefreshTokenPayload,
  AuthTokens,
} from '@/types/auth';
import { SignJWT, jwtVerify, errors, decodeJwt } from 'jose';
import { redis } from '@/db/redis';
import { env } from '@/shared/config/env';

type TokenVerificationResult<TPayload> =
  | { status: 'valid'; payload: TPayload }
  | { status: 'expired'; payload: TPayload | null }
  | { status: 'invalid'; payload: null };

const COOKIE_BASE = {
  httpOnly: true,
  path: '/',
  sameSite: 'lax' as const,
  secure: env.NODE_ENV === 'production',
} as const;

const REFRESH_PREFIX = 'refresh:';

export class AuthUtils {
  private static readonly ACCESS_SECRET = new TextEncoder().encode(
    env.JWT_ACCESS_SECRET,
  );
  private static readonly REFRESH_SECRET = new TextEncoder().encode(
    env.JWT_REFRESH_SECRET,
  );

  static async hashPassword(password: string): Promise<string> {
    return argon2.hash(password);
  }

  static async verifyPassword(
    hash: string,
    password: string,
  ): Promise<boolean> {
    try {
      return await argon2.verify(hash, password);
    } catch {
      return false;
    }
  }

  private static getRefreshKey(jti: string): string {
    return `${REFRESH_PREFIX}${jti}`;
  }

  private static async persistRefreshToken(
    jti: string,
    userId: number,
  ): Promise<void> {
    await redis.setex(
      this.getRefreshKey(jti),
      env.REFRESH_TTL_SEC,
      JSON.stringify({ userId }),
    );
  }

  static async isRefreshTokenActive(jti: string): Promise<boolean> {
    const token = await redis.get(this.getRefreshKey(jti));
    return Boolean(token);
  }

  static async revokeRefreshToken(jti: string): Promise<void> {
    await redis.del(this.getRefreshKey(jti));
  }

  static async revokeRefreshTokenByToken(refreshToken: string): Promise<void> {
    if (!refreshToken) return;
    const verification = await this.verifyRefreshToken(refreshToken);
    if (verification.payload?.jti) {
      await this.revokeRefreshToken(verification.payload.jti);
    }
  }

  private static async signAccessToken(user: {
    id: number;
    username: string;
    email: string;
  }): Promise<string> {
    return new SignJWT({
      sub: String(user.id),
      username: user.username,
      email: user.email,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${env.ACCESS_TTL_SEC}s`)
      .sign(this.ACCESS_SECRET);
  }

  private static async signRefreshToken(
    userId: number,
    jti: string,
  ): Promise<string> {
    return new SignJWT({ sub: String(userId), jti })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${env.REFRESH_TTL_SEC}s`)
      .sign(this.REFRESH_SECRET);
  }

  static async createAuthSession(
    user: { id: number; username: string; email: string },
    options?: { previousRefreshTokenId?: string },
  ): Promise<{ tokens: AuthTokens; refreshTokenId: string }> {
    if (options?.previousRefreshTokenId) {
      await this.revokeRefreshToken(options.previousRefreshTokenId);
    }

    const refreshTokenId = nanoid(32);

    const [accessToken, refreshToken] = await Promise.all([
      this.signAccessToken(user),
      this.signRefreshToken(user.id, refreshTokenId),
    ]);

    await this.persistRefreshToken(refreshTokenId, user.id);

    return { tokens: { accessToken, refreshToken }, refreshTokenId };
  }

  static async verifyAccessToken(
    token: string | undefined,
  ): Promise<TokenVerificationResult<AccessTokenPayload>> {
    if (!token) return { status: 'invalid', payload: null };

    try {
      const { payload } = await jwtVerify(token, this.ACCESS_SECRET);
      return { status: 'valid', payload: payload as AccessTokenPayload };
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        try {
          const payload = decodeJwt(token);
          return { status: 'expired', payload: payload as AccessTokenPayload };
        } catch {
          return { status: 'invalid', payload: null };
        }
      }
      return { status: 'invalid', payload: null };
    }
  }

  static async verifyRefreshToken(
    token: string | undefined,
  ): Promise<TokenVerificationResult<RefreshTokenPayload>> {
    if (!token) return { status: 'invalid', payload: null };

    try {
      const { payload } = await jwtVerify(token, this.REFRESH_SECRET);
      const refreshPayload = payload as RefreshTokenPayload;

      if (!refreshPayload.jti) return { status: 'invalid', payload: null };

      return { status: 'valid', payload: refreshPayload };
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        try {
          const payload = decodeJwt(token) as RefreshTokenPayload;
          if (payload?.jti) await this.revokeRefreshToken(payload.jti);
          return { status: 'expired', payload };
        } catch {
          return { status: 'invalid', payload: null };
        }
      }
      return { status: 'invalid', payload: null };
    }
  }

  static applyAuthCookies(cookie: CookieStore, tokens: AuthTokens): void {
    cookie.accessToken.set({
      value: tokens.accessToken,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: env.ACCESS_TTL_SEC,
    });

    cookie.refreshToken.set({
      value: tokens.refreshToken,
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: env.REFRESH_TTL_SEC,
    });
  }

  static clearAuthCookies(cookie: CookieStore): void {
    cookie.accessToken.remove();
    cookie.refreshToken.remove();
  }
}

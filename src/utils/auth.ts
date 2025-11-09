import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { SignJWT, jwtVerify, errors, type JWTPayload, decodeJwt } from 'jose';
import { redis } from '@/db/redis';
import { env } from '@/shared/config/env';

export type CookieStore = Record<
  string,
  {
    value?: string;
    httpOnly?: boolean;
    path?: string;
    sameSite?: 'lax' | 'strict' | 'none';
    secure?: boolean;
    maxAge?: number;
    expires?: Date;
  }
>;

export type AccessTokenPayload = JWTPayload & {
  sub: string;
  username: string;
  email: string;
};

export type RefreshTokenPayload = JWTPayload & {
  sub: string;
  jti: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type TokenVerificationResult<TPayload> =
  | { status: 'valid'; payload: TPayload }
  | { status: 'expired'; payload: TPayload | null }
  | { status: 'invalid'; payload: null };

export class AuthUtils {
  private static readonly ACCESS_SECRET = new TextEncoder().encode(
    env.JWT_ACCESS_SECRET
  );
  private static readonly REFRESH_SECRET = new TextEncoder().encode(
    env.JWT_REFRESH_SECRET
  );
  private static readonly REFRESH_PREFIX = 'refresh:';
  private static ensureCookieSlot(
    cookie: CookieStore,
    name: 'accessToken' | 'refreshToken'
  ) {
    if (!cookie[name]) {
      cookie[name] = {};
    }

    return cookie[name];
  }

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

  private static getRefreshKey(refreshTokenId: string): string {
    return `${this.REFRESH_PREFIX}${refreshTokenId}`;
  }

  private static async persistRefreshToken(
    refreshTokenId: string,
    userId: number
  ): Promise<void> {
    await redis.setex(
      this.getRefreshKey(refreshTokenId),
      env.REFRESH_TTL_SEC,
      JSON.stringify({ userId })
    );
  }

  private static async refreshTokenExists(
    refreshTokenId: string
  ): Promise<boolean> {
    const token = await redis.get(this.getRefreshKey(refreshTokenId));
    return Boolean(token);
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
    refreshTokenId: string
  ): Promise<string> {
    return new SignJWT({
      sub: String(userId),
      jti: refreshTokenId,
    })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuedAt()
      .setExpirationTime(`${env.REFRESH_TTL_SEC}s`)
      .sign(this.REFRESH_SECRET);
  }

  static async createAuthSession(
    user: { id: number; username: string; email: string },
    options?: { previousRefreshTokenId?: string }
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

    return {
      tokens: {
        accessToken,
        refreshToken,
      },
      refreshTokenId,
    };
  }

  static async revokeRefreshToken(refreshTokenId: string): Promise<void> {
    await redis.del(this.getRefreshKey(refreshTokenId));
  }

  static async revokeRefreshTokenByToken(refreshToken: string): Promise<void> {
    if (!refreshToken) return;

    const verification = await this.verifyRefreshToken(refreshToken);

    if (verification.status === 'valid' && verification.payload) {
      await this.revokeRefreshToken(verification.payload.jti);
    } else if (verification.status === 'expired' && verification.payload) {
      await this.revokeRefreshToken(verification.payload.jti);
    }
  }

  static async verifyAccessToken(
    token: string | undefined
  ): Promise<TokenVerificationResult<AccessTokenPayload>> {
    if (!token) {
      return { status: 'invalid', payload: null };
    }

    try {
      const { payload } = await jwtVerify(token, this.ACCESS_SECRET);
      return {
        status: 'valid',
        payload: payload as AccessTokenPayload,
      };
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        try {
          const payload = decodeJwt(token);
          return {
            status: 'expired',
            payload: payload as AccessTokenPayload,
          };
        } catch {
          return {
            status: 'invalid',
            payload: null,
          };
        }
      }

      return { status: 'invalid', payload: null };
    }
  }

  static async verifyRefreshToken(
    token: string | undefined
  ): Promise<TokenVerificationResult<RefreshTokenPayload>> {
    if (!token) {
      return { status: 'invalid', payload: null };
    }

    try {
      const { payload } = await jwtVerify(token, this.REFRESH_SECRET);
      const refreshPayload = payload as RefreshTokenPayload;

      if (!refreshPayload.jti) {
        return { status: 'invalid', payload: null };
      }

      const exists = await this.refreshTokenExists(refreshPayload.jti);
      if (!exists) {
        return { status: 'invalid', payload: null };
      }

      return { status: 'valid', payload: refreshPayload };
    } catch (error) {
      if (error instanceof errors.JWTExpired) {
        try {
          const payload = decodeJwt(token);
          const refreshPayload = payload as RefreshTokenPayload;

          if (refreshPayload?.jti) {
            await this.revokeRefreshToken(refreshPayload.jti);
          }

          return {
            status: 'expired',
            payload: refreshPayload,
          };
        } catch {
          return {
            status: 'invalid',
            payload: null,
          };
        }
      }

      return { status: 'invalid', payload: null };
    }
  }

  static applyAuthCookies(cookie: CookieStore, tokens: AuthTokens): void {
    const accessCookie = this.ensureCookieSlot(cookie, 'accessToken');
    Object.assign(accessCookie, {
      value: tokens.accessToken,
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      secure: env.NODE_ENV === 'production',
      maxAge: env.ACCESS_TTL_SEC,
    });

    const refreshCookie = this.ensureCookieSlot(cookie, 'refreshToken');
    Object.assign(refreshCookie, {
      value: tokens.refreshToken,
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      secure: env.NODE_ENV === 'production',
      maxAge: env.REFRESH_TTL_SEC,
    });
  }

  static clearAuthCookies(cookie: CookieStore): void {
    const accessCookie = this.ensureCookieSlot(cookie, 'accessToken');
    Object.assign(accessCookie, {
      value: '',
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      secure: env.NODE_ENV === 'production',
      expires: new Date(0),
    });

    const refreshCookie = this.ensureCookieSlot(cookie, 'refreshToken');
    Object.assign(refreshCookie, {
      value: '',
      httpOnly: true,
      path: '/',
      sameSite: 'lax' as const,
      secure: env.NODE_ENV === 'production',
      expires: new Date(0),
    });
  }
}

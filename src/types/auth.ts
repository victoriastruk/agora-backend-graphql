import type { JWTPayload } from 'jose';

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

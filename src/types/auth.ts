import type { Cookie } from 'elysia';
import type { JWTPayload } from 'jose';

export type CookieStore = {
  accessToken: Cookie<string>;
  refreshToken: Cookie<string>;
};

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
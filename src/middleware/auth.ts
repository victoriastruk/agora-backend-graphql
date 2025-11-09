import { Elysia } from 'elysia';
import { AuthUtils, type CookieStore } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';

export const authMiddleware = new Elysia().derive(async ({ cookie, set }) => {
  const cookieStore = cookie as CookieStore;
  const accessToken =
    typeof cookieStore.accessToken?.value === 'string'
      ? cookieStore.accessToken.value
      : undefined;
  const refreshToken =
    typeof cookieStore.refreshToken?.value === 'string'
      ? cookieStore.refreshToken.value
      : undefined;

  const accessVerification = await AuthUtils.verifyAccessToken(accessToken);

  if (accessVerification.status === 'invalid') {
    return {
      user: null,
    };
  }

  let userId: number | null = null;
  let refreshTokenIdToRevoke: string | undefined;

  if (accessVerification.status === 'valid' && accessVerification.payload) {
    userId = Number(accessVerification.payload.sub);
  } else if (accessVerification.status === 'expired' && refreshToken) {
    const refreshVerification =
      await AuthUtils.verifyRefreshToken(refreshToken);

    if (refreshVerification.status === 'valid' && refreshVerification.payload) {
      userId = Number(refreshVerification.payload.sub);
      refreshTokenIdToRevoke = refreshVerification.payload.jti;
    } else {
      AuthUtils.clearAuthCookies(cookieStore);
      return {
        user: null,
      };
    }
  }

  if (!userId) {
    return {
      user: null,
    };
  }

  const user = await AuthQueries.findUserById(userId);

  if (!user) {
    AuthUtils.clearAuthCookies(cookieStore);
    return {
      user: null,
    };
  }

  if (refreshTokenIdToRevoke) {
    const session = await AuthUtils.createAuthSession(user, {
      previousRefreshTokenId: refreshTokenIdToRevoke,
    });
    AuthUtils.applyAuthCookies(cookieStore, session.tokens);
  }

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
  };
});

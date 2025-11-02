import { Elysia } from 'elysia';
import { AuthUtils } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';

export const authMiddleware = new Elysia().derive(async ({ cookie, set }) => {
  const sessionId = cookie.sessionId?.value;

  if (!sessionId || typeof sessionId !== 'string') {
    return {
      user: null,
      sessionId: null,
    };
  }

  const session = await AuthUtils.getSession(sessionId);

  if (!session) {
    cookie.sessionId.value = '';
    cookie.sessionId.expires = new Date(0);

    return {
      user: null,
      sessionId: null,
    };
  }

  const user = await AuthQueries.findUserById(session.userId);

  if (!user) {
    return {
      user: null,
      sessionId: null,
    };
  }

  if (typeof sessionId === 'string') {
    await AuthUtils.extendSession(sessionId);
  }

  const { passwordHash: _, ...safeUser } = user;

  return {
    user: safeUser,
    sessionId,
  };
});

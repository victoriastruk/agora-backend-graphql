import { Elysia, t } from 'elysia';
import { AuthUtils } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';
import { ResponseUtils } from '@/utils/ResponseUtils';
import { registerSchema, loginSchema } from '@/types/auth';

export const authController = new Elysia({ prefix: '/api' })
  .post(
    '/register',
    async ({ body, set, cookie }) => {
      try {
        const { username, email, password } = body;

        const userExists =
          (await AuthQueries.findUserByUsernameOrEmail(username)) ||
          (await AuthQueries.findUserByUsernameOrEmail(email));

        if (userExists) {
          set.status = 409;
          return ResponseUtils.error('User already exists', 409);
        }

        const passwordHash = await AuthUtils.hashPassword(password);
        const newUser = await AuthQueries.createUser({
          username,
          email,
          passwordHash,
        });

        const sessionId = await AuthUtils.createSession(newUser.id);
        Object.assign(cookie['sessionId'], {
          value: sessionId,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          // secure: process.env.NODE_ENV === 'production',
          secure: false,
          maxAge: 7 * 24 * 60 * 60,
        });

        set.status = 201;
        return ResponseUtils.success('User registered and logged in', 201);
      } catch (error) {
        const err = error as Error;
        console.error('Registration error:', err);

        if (err.name === 'ZodError') {
          set.status = 400;
          return ResponseUtils.error('Invalid input data', 400);
        }

        set.status = 500;
        return ResponseUtils.error('Internal server error', 500);
      }
    },
    {
      body: registerSchema,
      tags: ['Authentication'],
      summary: 'Register and login user',
      response: {
        201: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        400: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        409: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        500: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    }
  )
  .post(
    '/login',
    async ({ body, set, cookie }) => {
      try {
        const { usernameOrEmail, password } = body;

        const user =
          await AuthQueries.findUserByUsernameOrEmail(usernameOrEmail);
        if (
          !user ||
          !(await AuthUtils.verifyPassword(user.passwordHash, password))
        ) {
          set.status = 401;
          return ResponseUtils.error('Invalid credentials', 401);
        }

        const sessionId = await AuthUtils.createSession(user.id);
        Object.assign(cookie['sessionId'], {
          value: sessionId,
          httpOnly: true,
          path: '/',
          sameSite: 'lax',
          // secure: process.env.NODE_ENV === 'production',
          secure: false,
          maxAge: 7 * 24 * 60 * 60,
        });

        set.status = 200;
        return ResponseUtils.success('Login successful', 200);
      } catch (error) {
        console.error('Login error:', error);
        set.status = 500;
        return ResponseUtils.error('Internal server error', 500);
      }
    },
    {
      body: loginSchema,
      tags: ['Authentication'],
      summary: 'Login user',

      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        401: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        500: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    }
  )

  .post(
    '/logout',
    async ({ cookie, set }) => {
      try {
        const sessionId = cookie.sessionId?.value;

        if (sessionId && typeof sessionId === 'string') {
          await AuthUtils.destroySession(sessionId);
        }

        cookie.sessionId.value = '';
        cookie.sessionId.httpOnly = true;
        cookie.sessionId.path = '/';
        cookie.sessionId.sameSite = 'lax';
        // cookie.sessionId.secure = process.env.NODE_ENV === 'production';
        cookie.sessionId.secure = false;
        cookie.sessionId.expires = new Date(0);

        set.status = 200;
        return {
          success: true,
          message: 'Logout successful',
        };
      } catch (error) {
        console.error('Logout error:', error);
        set.status = 500;
        return {
          success: false,
          message: 'Internal server error',
        };
      }
    },
    {
      tags: ['Authentication'],
      summary: 'Logout user',
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        500: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    }
  )

  .get(
    '/me',
    async ({ cookie, set }) => {
      try {
        const sessionId = cookie.sessionId?.value;

        if (!sessionId || typeof sessionId !== 'string') {
          set.status = 401;
          return {
            success: false,
            message: 'Not authenticated',
            data: null,
          };
        }

        const session = await AuthUtils.getSession(sessionId);

        if (!session) {
          cookie.sessionId.value = '';
          cookie.sessionId.expires = new Date(0);

          set.status = 401;
          return ResponseUtils.error('Session expired', 401);
        }

        const user = await AuthQueries.findUserById(session.userId);

        if (!user) {
          set.status = 401;
          return ResponseUtils.error('User not found', 401);
        }

        if (typeof sessionId === 'string') {
          await AuthUtils.extendSession(sessionId);
        }

        const { passwordHash: _, ...userResponse } = user;
        const formattedUser = {
          ...userResponse,
          createdAt: userResponse.createdAt
            ? new Date(userResponse.createdAt).toISOString()
            : undefined,
        };
        return ResponseUtils.success('User authenticated', {
          user: formattedUser,
        });
      } catch (error) {
        console.error('Auth check error:', error);
        set.status = 500;
        return {
          success: false,
          message: 'Internal server error',
          data: null,
        };
      }
    },
    {
      tags: ['Authentication'],
      summary: 'Get current user',
      response: {
        200: t.Object({
          success: t.Boolean(),
          message: t.String(),
          data: t.Object({
            user: t.Object({
              id: t.Number(),
              username: t.String(),
              email: t.String(),
              createdAt: t.Optional(t.String({ format: 'date-time' })),
            }),
          }),
        }),
        401: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
        500: t.Object({
          success: t.Boolean(),
          message: t.String(),
        }),
      },
    }
  );

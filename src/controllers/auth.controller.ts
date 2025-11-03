import { Elysia, t } from 'elysia';
import { AuthUtils } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';
import { ResponseUtils } from '@/utils/ResponseUtils';
import { registerSchema, loginSchema } from '@/types/auth';

export const authController = new Elysia({ prefix: '/api' })
  .post(
    '/register',
    async ({ body, set }) => {
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

        await AuthQueries.createUser({
          username,
          email,
          passwordHash,
        });

        set.status = 201;
        return ResponseUtils.success('User registered successfully', 201);
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
      detail: {
        summary: 'Register a new user',
        tags: ['Authentication'],
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
          return ResponseUtils.success('Invalid credentials');
        }

        const sessionId = await AuthUtils.createSession(user.id);

        const sessionCookie = cookie['sessionId'];
        Object.assign(sessionCookie, {
          value: sessionId,
          httpOnly: true,
          path: '/',
          sameSite: 'strict',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60,
          domain: 'localhost',
        });

        set.status = 200;
        return ResponseUtils.success('Login successful');
      } catch (error) {
        const err = error as Error;
        console.error('Login error:', err);

        if (err.name === 'ZodError') {
          set.status = 400;
          return ResponseUtils.error('Invalid input data', 400);
        }

        set.status = 500;
        return ResponseUtils.error('Internal server error', 500);
      }
    },
    {
      body: loginSchema,
      detail: {
        summary: 'Login user',
        tags: ['Authentication'],
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
        // cookie.sessionId.httpOnly = false;
        cookie.sessionId.path = '/';
        cookie.sessionId.sameSite = 'strict';
        cookie.sessionId.secure = process.env.NODE_ENV === 'production';
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
      detail: {
        summary: 'Logout user',
        description:
          'Logs out the current user by destroying their session and clearing the session cookie.',
        tags: ['Authentication'],
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
          return {
            success: false,
            message: 'Session expired',
            data: null,
          };
        }

        const user = await AuthQueries.findUserById(session.userId);

        if (!user) {
          set.status = 401;
          return {
            success: false,
            message: 'User not found',
            data: null,
          };
        }

        if (typeof sessionId === 'string') {
          await AuthUtils.extendSession(sessionId);
        }

        const { passwordHash: _, ...userResponse } = user;

        return {
          success: true,
          message: 'User authenticated',
          data: {
            user: userResponse,
          },
        };
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
      detail: {
        summary: 'Get current user',
        description:
          "Retrieves the currently authenticated user's information based on their session cookie.",
        tags: ['Authentication'],
      },
    }
  );

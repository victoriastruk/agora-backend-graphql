import { Elysia } from 'elysia';
import { AuthUtils } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';
import { registerSchema, loginSchema } from '@/types/auth';

export const authController = new Elysia({ prefix: '/auth' })

  .post('/register', async ({ body, set }) => {
    try {
      const validatedData = registerSchema.parse(body);

      const existingUser = await AuthQueries.findUserByUsernameOrEmail(
        validatedData.username
      );

      if (existingUser) {
        set.status = 409;
        return {
          success: false,
          message: 'Username or email already exists',
          data: null,
        };
      }

      const existingEmail = await AuthQueries.findUserByUsernameOrEmail(
        validatedData.email
      );

      if (existingEmail) {
        set.status = 409;
        return {
          success: false,
          message: 'Username or email already exists',
          data: null,
        };
      }

      const passwordHash = await AuthUtils.hashPassword(validatedData.password);

      await AuthQueries.createUser({
        username: validatedData.username,
        email: validatedData.email,
        passwordHash,
      });

      set.status = 201;
      return {
        success: true,
        message: 'User registered successfully',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        set.status = 400;
        return {
          success: false,
          message: 'Invalid input data',
          data: null,
        };
      }

      console.error('Registration error:', error);
      set.status = 500;
      return {
        success: false,
        message: 'Internal server error',
        data: null,
      };
    }
  })

  .post('/login', async ({ body, set, cookie }) => {
    try {
      const validatedData = loginSchema.parse(body);

      const user = await AuthQueries.findUserByUsernameOrEmail(
        validatedData.usernameOrEmail
      );

      if (!user) {
        set.status = 401;
        return {
          success: false,
          message: 'Invalid credentials',
          data: null,
        };
      }

      const isValidPassword = await AuthUtils.verifyPassword(
        user.passwordHash,
        validatedData.password
      );

      if (!isValidPassword) {
        set.status = 401;
        return {
          success: false,
          message: 'Invalid credentials',
          data: null,
        };
      }

      const sessionId = await AuthUtils.createSession(user.id);

      cookie['sessionId'].value = sessionId;
      cookie['sessionId'].httpOnly = true;
      cookie['sessionId'].path = '/';
      cookie['sessionId'].sameSite = 'strict';
      cookie['sessionId'].secure = process.env.NODE_ENV === 'production';
      cookie['sessionId'].maxAge = 7 * 24 * 60 * 60; // 7 days

      set.status = 200;
      return {
        success: true,
        message: 'Login successful',
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        set.status = 400;
        return {
          success: false,
          message: 'Invalid input data',
          data: null,
        };
      }

      console.error('Login error:', error);
      set.status = 500;
      return {
        success: false,
        message: 'Internal server error',
        data: null,
      };
    }
  })

  .post('/logout', async ({ cookie, set }) => {
    try {
      const sessionId = cookie.sessionId?.value;

      if (sessionId && typeof sessionId === 'string') {
        await AuthUtils.destroySession(sessionId);
      }

      cookie.sessionId.value = '';
      cookie.sessionId.httpOnly = true;
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
  })

  .get('/me', async ({ cookie, set }) => {
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
  });

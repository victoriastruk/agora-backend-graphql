import { Elysia, t } from 'elysia';
import { AuthUtils, type CookieStore } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';
import { ResponseUtils } from '@/utils/ResponseUtils';

export const authController = new Elysia({ prefix: '/auth' })
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

        const session = await AuthUtils.createAuthSession(newUser);
        AuthUtils.applyAuthCookies(cookie as CookieStore, session.tokens);

        const { passwordHash: _, ...userResponse } = newUser;
        const formattedUser = {
          ...userResponse,
          createdAt: userResponse.createdAt
            ? new Date(userResponse.createdAt).toISOString()
            : undefined,
        };

        set.status = 201;
        return ResponseUtils.success('User registered successfully', {
          user: formattedUser,
        });
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
      body: t.Object({
        username: t.String({
          minLength: 3,
          maxLength: 30,
          pattern: '^[a-zA-Z0-9_]+$',
        }),
        email: t.String({ format: 'email' }),
        password: t.String({ minLength: 6 }),
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Register and login user',
        responses: {
          201: {
            description: 'User registered successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'User registered successfully',
                    },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            username: { type: 'string', example: 'john_doe' },
                            email: {
                              type: 'string',
                              example: 'john@example.com',
                            },
                            createdAt: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid input data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid input data' },
                  },
                },
              },
            },
          },
          409: {
            description: 'User already exists',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'User already exists' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Internal server error',
                    },
                  },
                },
              },
            },
          },
        },
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

        const session = await AuthUtils.createAuthSession(user);
        AuthUtils.applyAuthCookies(cookie as CookieStore, session.tokens);

        const { passwordHash: _, ...userResponse } = user;
        const formattedUser = {
          ...userResponse,
          createdAt: userResponse.createdAt
            ? new Date(userResponse.createdAt).toISOString()
            : undefined,
        };

        set.status = 200;
        return ResponseUtils.success('Login successful', {
          user: formattedUser,
        });
      } catch (error) {
        console.error('Login error:', error);
        set.status = 500;
        return ResponseUtils.error('Internal server error', 500);
      }
    },
    {
      body: t.Object({
        usernameOrEmail: t.String({ minLength: 3 }),
        password: t.String({ minLength: 6 }),
      }),
      detail: {
        tags: ['Authentication'],
        summary: 'Login user',
        responses: {
          200: {
            description: 'Login successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Login successful' },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            username: { type: 'string', example: 'john_doe' },
                            email: {
                              type: 'string',
                              example: 'john@example.com',
                            },
                            createdAt: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Invalid credentials',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid credentials' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Internal server error',
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  )

  .post(
    '/logout',
    async ({ cookie, set }) => {
      try {
        const refreshToken = cookie.refreshToken?.value;

        if (refreshToken && typeof refreshToken === 'string') {
          await AuthUtils.revokeRefreshTokenByToken(refreshToken);
        }

        AuthUtils.clearAuthCookies(cookie as CookieStore);

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
        tags: ['Authentication'],
        summary: 'Logout user',
        responses: {
          200: {
            description: 'Logout successful',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Logout successful' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Internal server error',
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  )

  .get(
    '/me',
    async ({ cookie, set }) => {
      try {
        const accessToken = cookie.accessToken?.value;
        const refreshToken = cookie.refreshToken?.value;

        const accessVerification = await AuthUtils.verifyAccessToken(
          typeof accessToken === 'string' ? accessToken : undefined
        );

        let userId: number | null = null;
        let refreshTokenIdToRevoke: string | undefined;

        if (
          accessVerification.status === 'valid' &&
          accessVerification.payload
        ) {
          userId = Number(accessVerification.payload.sub);
        } else if (
          accessVerification.status === 'expired' &&
          refreshToken &&
          typeof refreshToken === 'string'
        ) {
          const refreshVerification =
            await AuthUtils.verifyRefreshToken(refreshToken);

          if (
            refreshVerification.status === 'valid' &&
            refreshVerification.payload
          ) {
            userId = Number(refreshVerification.payload.sub);
            refreshTokenIdToRevoke = refreshVerification.payload.jti;
          } else {
            AuthUtils.clearAuthCookies(cookie as CookieStore);
            set.status = 401;
            return ResponseUtils.error('Session expired', 401);
          }
        } else {
          AuthUtils.clearAuthCookies(cookie as CookieStore);
          set.status = 401;
          return ResponseUtils.error('Not authenticated', 401);
        }

        const user = userId ? await AuthQueries.findUserById(userId) : null;

        if (!user) {
          AuthUtils.clearAuthCookies(cookie as CookieStore);
          set.status = 401;
          return ResponseUtils.error('User not found', 401);
        }

        if (refreshTokenIdToRevoke) {
          const session = await AuthUtils.createAuthSession(user, {
            previousRefreshTokenId: refreshTokenIdToRevoke,
          });
          AuthUtils.applyAuthCookies(cookie as CookieStore, session.tokens);
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
      detail: {
        tags: ['Authentication'],
        summary: 'Get current user',
        responses: {
          200: {
            description: 'User authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'User authenticated' },
                    data: {
                      type: 'object',
                      properties: {
                        user: {
                          type: 'object',
                          properties: {
                            id: { type: 'integer', example: 1 },
                            username: { type: 'string', example: 'john_doe' },
                            email: {
                              type: 'string',
                              example: 'john@example.com',
                            },
                            createdAt: { type: 'string', format: 'date-time' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: {
            description: 'Not authenticated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Not authenticated' },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Internal server error',
                    },
                  },
                },
              },
            },
          },
        },
      },
    }
  );

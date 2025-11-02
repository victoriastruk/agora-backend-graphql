import { Elysia, t } from 'elysia';
import { AuthUtils } from '@/utils/auth';
import { AuthQueries } from '@/db/queries/auth';
import { registerSchema, loginSchema } from '@/types/auth';

export const authController = new Elysia({ prefix: '/auth' })
  .post(
    '/register',
    async ({ body, set }) => {
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

        const passwordHash = await AuthUtils.hashPassword(
          validatedData.password
        );

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
    },
    {
      body: t.Object({
        username: t.String({
          minLength: 3,
          maxLength: 30,
          pattern: '^[a-zA-Z0-9_]+$',
          description:
            'Username (3-30 characters, alphanumeric and underscore only)',
          examples: ['john_doe'],
        }),
        email: t.String({
          format: 'email',
          description: 'Valid email address',
          examples: ['john@example.com'],
        }),
        password: t.String({
          minLength: 8,
          maxLength: 100,
          description: 'Password (8-100 characters)',
          examples: ['SecurePass123!'],
        }),
      }),
      detail: {
        summary: 'Register a new user',
        description:
          'Creates a new user account. The password will be securely hashed using Argon2 before storage. Username must be unique and contain only alphanumeric characters and underscores.',
        tags: ['Authentication'],
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
                  },
                },
              },
            },
          },
          400: {
            description:
              'Validation error - invalid input data (username format, email format, or password length)',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid input data' },
                    data: { type: 'object', nullable: true },
                  },
                },
              },
            },
          },
          409: {
            description: 'Conflict - username or email already exists',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Username or email already exists',
                    },
                    data: { type: 'object', nullable: true },
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
                    data: { type: 'object', nullable: true },
                  },
                  required: ['success', 'message'],
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
    },
    {
      body: t.Object({
        usernameOrEmail: t.String({
          minLength: 1,
          description: 'Username or email address',
          examples: ['john_doe', 'john@example.com'],
        }),
        password: t.String({
          minLength: 1,
          description: 'User password',
          examples: ['SecurePass123!'],
        }),
      }),
      detail: {
        summary: 'Login user',
        description:
          'Authenticates a user and creates a session. The session ID is stored in an HTTP-only cookie. You can login using either username or email address.',
        tags: ['Authentication'],
        responses: {
          200: {
            description: 'Login successful - session cookie set',
            headers: {
              'Set-Cookie': {
                description: 'Session ID stored in HTTP-only cookie',
                schema: {
                  type: 'string',
                  example: 'sessionId=xxx; HttpOnly; Path=/; SameSite=Strict',
                },
              },
            },
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: { type: 'string', example: 'Login successful' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Validation error - invalid input data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid input data' },
                    data: { type: 'object', nullable: true },
                  },
                },
              },
            },
          },
          401: {
            description: 'Unauthorized - invalid credentials',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid credentials' },
                    data: { type: 'object', nullable: true },
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
                    data: { type: 'object', nullable: true },
                  },
                  required: ['success', 'message'],
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
    },
    {
      detail: {
        summary: 'Logout user',
        description:
          'Logs out the current user by destroying their session and clearing the session cookie. Works even if no valid session exists.',
        tags: ['Authentication'],
        responses: {
          200: {
            description: 'Logout successful - session cookie cleared',
            headers: {
              'Set-Cookie': {
                description: 'Session cookie cleared',
                schema: {
                  type: 'string',
                  example:
                    'sessionId=; HttpOnly; Path=/; SameSite=Strict; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
                },
              },
            },
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
                    data: { type: 'object', nullable: true },
                  },
                  required: ['success', 'message'],
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
          "Retrieves the currently authenticated user's information based on their session cookie. The session TTL is automatically extended on successful requests.",
        tags: ['Authentication'],
        responses: {
          200: {
            description: 'Successfully retrieved user information',
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
            description: 'Unauthorized - not authenticated or session expired',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Not authenticated' },
                    data: { type: 'object', nullable: true },
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
                    data: { type: 'object', nullable: true },
                  },
                  required: ['success', 'message'],
                },
              },
            },
          },
        },
      },
    }
  );

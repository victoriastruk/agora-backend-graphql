import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, type User, type NewUser } from '@/db/schema';
import { AuthUtils } from '@/utils/auth';

export const usersRoutes = new Elysia({ prefix: '/users' })
  .get(
    '/',
    async () => {
      try {
        const allUsers = await db.select().from(users);
        const safeUsers = allUsers.map(({ passwordHash, ...user }) => user);
        return {
          success: true,
          data: safeUsers,
          count: safeUsers.length,
        };
      } catch (error) {
        if (error instanceof Error) {
          const userFriendlyMessages = [
            'User not found',
            'Username already exists',
            'Email already exists',
            'Invalid user ID',
          ];
          if (userFriendlyMessages.some((msg) => error.message.includes(msg))) {
            throw error;
          }
          if (process.env.NODE_ENV !== 'test') {
            console.error('Database error in GET /users:', error);
          }
        }
        throw new Error('Failed to fetch users');
      }
    },
    {
      detail: {
        summary: 'Get all users',
        description:
          'Retrieves a list of all users in the system. Password hashes are excluded from the response for security.',
        tags: ['Users'],
        responses: {
          200: {
            description: 'Successfully retrieved users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: {
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
                    count: { type: 'integer', example: 10 },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal server error - failed to fetch users',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Failed to fetch users',
                    },
                    error: {
                      type: 'string',
                      example: 'Database connection failed',
                    },
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
    '/:id',
    async ({ params: { id } }) => {
      try {
        const userId = parseInt(id);
        if (isNaN(userId) || userId < 0) {
          throw new Error('Invalid user ID');
        }

        const result = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!result[0]) {
          throw new Error('User not found');
        }

        const { passwordHash, ...safeUser } = result[0];

        return {
          success: true,
          data: safeUser,
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('CONNECTION_ENDED')
        ) {
          throw new Error('Database connection failed');
        }
        throw error;
      }
    },
    {
      params: t.Object({
        id: t.String({ description: 'User ID' }),
      }),
      detail: {
        summary: 'Get user by ID',
        description:
          'Retrieves a specific user by their unique identifier. Password hash is excluded from the response.',
        tags: ['Users'],
        responses: {
          200: {
            description: 'Successfully retrieved user',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 1 },
                        username: { type: 'string', example: 'john_doe' },
                        email: { type: 'string', example: 'john@example.com' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request - invalid user ID format',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid user ID' },
                  },
                  required: ['success', 'message'],
                },
              },
            },
          },
          500: {
            description: 'User not found, invalid user ID, or database error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'User not found',
                    },
                    error: {
                      type: 'string',
                      example: 'Database connection failed',
                    },
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
    '/',
    async ({ body, set }) => {
      try {
        const userData = body as NewUser;

        if (!userData.passwordHash) {
          throw new Error('Password is required');
        }

        const passwordHash = await AuthUtils.hashPassword(
          userData.passwordHash
        );

        const newUser: NewUser = {
          ...userData,
          passwordHash,
        };

        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.username, newUser.username))
          .limit(1);

        if (existingUser[0]) {
          throw new Error('Username already exists');
        }

        const existingEmail = await db
          .select()
          .from(users)
          .where(eq(users.email, newUser.email))
          .limit(1);

        if (existingEmail[0]) {
          throw new Error('Email already exists');
        }

        const result = await db.insert(users).values(newUser).returning();

        const { passwordHash: _, ...safeUser } = result[0];

        set.status = 201;
        return {
          success: true,
          data: safeUser,
          message: 'User created successfully',
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('CONNECTION_ENDED')
        ) {
          throw new Error('Database connection failed');
        }
        throw error;
      }
    },
    {
      body: t.Object({
        username: t.String({
          minLength: 3,
          maxLength: 50,
          description: 'Unique username (3-50 characters)',
          examples: ['john_doe'],
        }),
        email: t.String({
          format: 'email',
          description: 'Valid email address',
          examples: ['john@example.com'],
        }),
        passwordHash: t.String({
          minLength: 8,
          description: 'Password hash (minimum 8 characters)',
        }),
      }),
      detail: {
        summary: 'Create a new user',
        description:
          'Creates a new user account. The password will be hashed before storage. Username and email must be unique.',
        tags: ['Users'],
        responses: {
          201: {
            description: 'User created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 1 },
                        username: { type: 'string', example: 'john_doe' },
                        email: { type: 'string', example: 'john@example.com' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    message: {
                      type: 'string',
                      example: 'User created successfully',
                    },
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
                    message: {
                      type: 'string',
                      example: 'Password is required',
                    },
                  },
                  required: ['success', 'message'],
                },
              },
            },
          },
          500: {
            description: 'Username or email already exists, or database error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Username already exists',
                    },
                    error: {
                      type: 'string',
                      example: 'Database connection failed',
                    },
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

  .put(
    '/:id',
    async ({ params: { id }, body }) => {
      try {
        const userId = parseInt(id);
        if (isNaN(userId)) {
          throw new Error('Invalid user ID');
        }

        const updateData: Partial<NewUser> = body as Partial<NewUser>;

        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!existingUser[0]) {
          throw new Error('User not found');
        }

        if (updateData.username) {
          const usernameConflict = await db
            .select()
            .from(users)
            .where(eq(users.username, updateData.username))
            .limit(1);

          if (usernameConflict[0] && usernameConflict[0].id !== userId) {
            throw new Error('Username already exists');
          }
        }

        if (updateData.email) {
          const emailConflict = await db
            .select()
            .from(users)
            .where(eq(users.email, updateData.email))
            .limit(1);

          if (emailConflict[0] && emailConflict[0].id !== userId) {
            throw new Error('Email already exists');
          }
        }

        const result = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, userId))
          .returning();

        const { passwordHash: _, ...safeUser } = result[0];

        return {
          success: true,
          data: safeUser,
          message: 'User updated successfully',
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('CONNECTION_ENDED')
        ) {
          throw new Error('Database connection failed');
        }
        throw error;
      }
    },
    {
      params: t.Object({
        id: t.String({ description: 'User ID to update' }),
      }),
      body: t.Object({
        username: t.Optional(
          t.String({
            minLength: 3,
            maxLength: 50,
            description: 'New username (3-50 characters)',
            examples: ['john_doe_updated'],
          })
        ),
        email: t.Optional(
          t.String({
            format: 'email',
            description: 'New email address',
            examples: ['john.updated@example.com'],
          })
        ),
      }),
      detail: {
        summary: 'Update user information',
        description:
          'Updates user information (username and/or email). All fields are optional. Username and email must remain unique.',
        tags: ['Users'],
        responses: {
          200: {
            description: 'User updated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 1 },
                        username: {
                          type: 'string',
                          example: 'john_doe_updated',
                        },
                        email: {
                          type: 'string',
                          example: 'john.updated@example.com',
                        },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                    },
                    message: {
                      type: 'string',
                      example: 'User updated successfully',
                    },
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
                    message: {
                      type: 'string',
                      example: 'Invalid input data',
                    },
                    error: {
                      type: 'string',
                      example: 'Validation Error',
                    },
                  },
                  required: ['success', 'message'],
                },
              },
            },
          },
          500: {
            description:
              'User not found, username/email conflict, or database error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'User not found',
                    },
                    error: {
                      type: 'string',
                      example: 'Username already exists',
                    },
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

  .delete(
    '/:id',
    async ({ params: { id }, set }) => {
      try {
        const userId = parseInt(id);
        if (isNaN(userId)) {
          throw new Error('Invalid user ID');
        }

        const existingUser = await db
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .limit(1);

        if (!existingUser[0]) {
          throw new Error('User not found');
        }

        const result = await db
          .delete(users)
          .where(eq(users.id, userId))
          .returning();

        set.status = 200;
        return {
          success: true,
          message: 'User deleted successfully',
          deletedCount: result.length,
        };
      } catch (error) {
        if (
          error instanceof Error &&
          error.message.includes('CONNECTION_ENDED')
        ) {
          throw new Error('Database connection failed');
        }
        throw error;
      }
    },
    {
      params: t.Object({
        id: t.String({ description: 'User ID to delete' }),
      }),
      detail: {
        summary: 'Delete a user',
        description:
          'Permanently deletes a user from the system. Associated sessions will also be deleted due to cascading foreign key constraints.',
        tags: ['Users'],
        responses: {
          200: {
            description: 'User deleted successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'User deleted successfully',
                    },
                    deletedCount: { type: 'integer', example: 1 },
                  },
                },
              },
            },
          },
          400: {
            description: 'Bad request - invalid user ID format',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid user ID' },
                  },
                  required: ['success', 'message'],
                },
              },
            },
          },
          500: {
            description: 'User not found, invalid user ID, or database error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'User not found',
                    },
                    error: {
                      type: 'string',
                      example: 'Database connection failed',
                    },
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

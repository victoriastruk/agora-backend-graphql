import { Elysia, t } from 'elysia';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, type User, type NewUser } from '@/db/schema';
import { AuthUtils } from '@/utils/auth';

export const usersRoutes = new Elysia({ prefix: '/users' })

  .get('/', async () => {
    try {
      const allUsers = await db.select().from(users);
      const safeUsers = allUsers.map(({ passwordHash, ...user }) => user);
      return {
        success: true,
        data: safeUsers,
        count: safeUsers.length,
      };
    } catch (error) {
      // Re-throw user-friendly errors as-is
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
        // Log the actual error for debugging (skip in test environment)
        if (process.env.NODE_ENV !== 'test') {
          console.error('Database error in GET /users:', error);
        }
      }
      throw new Error('Failed to fetch users');
    }
  })

  .get('/:id', async ({ params: { id } }) => {
    try {
      const userId = parseInt(id);
      if (isNaN(userId)) {
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
  })

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
        username: t.String({ minLength: 3, maxLength: 50 }),
        email: t.String({ format: 'email' }),
        passwordHash: t.String({ minLength: 8 }),
      }),
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
      body: t.Object({
        username: t.Optional(t.String({ minLength: 3, maxLength: 50 })),
        email: t.Optional(t.String({ format: 'email' })),
      }),
    }
  )

  .delete('/:id', async ({ params: { id }, set }) => {
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
  });

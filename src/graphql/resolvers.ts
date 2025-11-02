import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import type { User } from '@/db/schema';
import { AuthUtils } from '@/utils/auth';

export const resolvers = {
  Query: {
    users: async (): Promise<Omit<User, 'passwordHash'>[]> => {
      try {
        const allUsers = await db.select().from(users);
        // Remove sensitive data from response
        return allUsers.map(({ passwordHash, ...user }) => user);
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
      }
    },

    user: async (
      _: any,
      { id }: { id: string }
    ): Promise<Omit<User, 'passwordHash'> | null> => {
      try {
        const result = await db
          .select()
          .from(users)
          .where(eq(users.id, parseInt(id)))
          .limit(1);

        if (!result[0]) return null;

        // Remove sensitive data from response
        const { passwordHash, ...safeUser } = result[0];
        return safeUser;
      } catch (error) {
        console.error('Error fetching user:', error);
        throw new Error('Failed to fetch user');
      }
    },
  },

  Mutation: {
    createUser: async (
      _: any,
      {
        username,
        email,
        password,
      }: { username: string; email: string; password: string }
    ): Promise<Omit<User, 'passwordHash'>> => {
      try {
        // Hash the password
        const passwordHash = await AuthUtils.hashPassword(password);

        const result = await db
          .insert(users)
          .values({ username, email, passwordHash })
          .returning();

        // Remove sensitive data from response
        const { passwordHash: _, ...safeUser } = result[0];
        return safeUser;
      } catch (error) {
        console.error('Error creating user:', error);
        throw new Error('Failed to create user');
      }
    },

    updateUser: async (
      _: any,
      { id, username, email }: { id: string; username?: string; email?: string }
    ): Promise<Omit<User, 'passwordHash'> | null> => {
      try {
        const updateData: Partial<Pick<User, 'username' | 'email'>> = {};
        if (username) updateData.username = username;
        if (email) updateData.email = email;

        const result = await db
          .update(users)
          .set(updateData)
          .where(eq(users.id, parseInt(id)))
          .returning();

        if (!result[0]) return null;

        // Remove sensitive data from response
        const { passwordHash, ...safeUser } = result[0];
        return safeUser;
      } catch (error) {
        console.error('Error updating user:', error);
        throw new Error('Failed to update user');
      }
    },

    deleteUser: async (_: any, { id }: { id: string }): Promise<boolean> => {
      try {
        const result = await db
          .delete(users)
          .where(eq(users.id, parseInt(id)))
          .returning();

        return result.length > 0;
      } catch (error) {
        console.error('Error deleting user:', error);
        throw new Error('Failed to delete user');
      }
    },
  },
};

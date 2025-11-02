import { eq, or } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, sessions } from '@/db/schema';
import type { NewUser, User } from '@/db/schema';

export class AuthQueries {
  static async findUserByUsernameOrEmail(
    usernameOrEmail: string
  ): Promise<User | null> {
    let [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, usernameOrEmail))
      .limit(1);

    if (!user) {
      [user] = await db
        .select()
        .from(users)
        .where(eq(users.email, usernameOrEmail))
        .limit(1);
    }

    return user || null;
  }

  static async findUserById(id: number): Promise<User | null> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return user || null;
  }

  static async createUser(userData: NewUser): Promise<User> {
    const [user] = await db.insert(users).values(userData).returning();

    return user;
  }

  static async createSession(sessionData: {
    id: string;
    userId: number;
    expiresAt: Date;
  }): Promise<void> {
    await db.insert(sessions).values(sessionData);
  }

  static async deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  }

  static async cleanupExpiredSessions(): Promise<void> {
    await db.delete(sessions).where(eq(sessions.expiresAt, new Date()));
  }
}

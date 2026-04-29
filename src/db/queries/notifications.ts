import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notifications, type Notification, type NewNotification } from "@/db/schema";

export const notificationQueries = {
  async getByUserId(userId: number, limit = 20, offset = 0): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getUnreadCount(userId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)));
    return Number(result[0]?.count ?? 0);
  },

  async create(data: NewNotification): Promise<Notification> {
    const result = await db.insert(notifications).values(data).returning();
    return result[0];
  },

  async markAsRead(id: number, userId: number): Promise<Notification | null> {
    const result = await db
      .update(notifications)
      .set({ isRead: true })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result[0] || null;
  },

  async markAllAsRead(userId: number): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(eq(notifications.userId, userId));
  },

  async deleteOne(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
      .returning();
    return result.length > 0;
  },

  async deleteAll(userId: number): Promise<boolean> {
    await db.delete(notifications).where(eq(notifications.userId, userId));
    return true;
  },
};

import { eq, and, desc, isNull, isNotNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { reports } from '@/db/schema';
import type { Report, NewReport } from '@/db/schema';

export const reportQueries = {
  async getById(id: number): Promise<Report | null> {
    const result = await db
      .select()
      .from(reports)
      .where(eq(reports.id, id))
      .limit(1);
    return result[0] || null;
  },

  async getAll(status?: string, limit = 20, offset = 0): Promise<Report[]> {
    const conditions = [];
    if (status) {
      conditions.push(eq(reports.status, status));
    }

    const baseQuery = db
      .select()
      .from(reports)
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);

    if (conditions.length > 0) {
      return await baseQuery.where(and(...conditions));
    }
    return await baseQuery;
  },

  async getByPost(postId: number): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(eq(reports.postId, postId))
      .orderBy(desc(reports.createdAt));
  },

  async getByComment(commentId: number): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(eq(reports.commentId, commentId))
      .orderBy(desc(reports.createdAt));
  },

  async getPendingReports(limit = 20, offset = 0): Promise<Report[]> {
    return await db
      .select()
      .from(reports)
      .where(eq(reports.status, 'pending'))
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getByCommunity(
    communityId: number,
    limit = 20,
    offset = 0
  ): Promise<Report[]> {
    // This requires a join with posts to get reports for a specific community
    // For now, we'll implement this as a simple query
    return await db
      .select()
      .from(reports)
      .where(isNotNull(reports.postId))
      .orderBy(desc(reports.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async create(data: NewReport): Promise<Report> {
    const result = await db.insert(reports).values(data).returning();
    return result[0];
  },

  async updateStatus(
    id: number,
    status: string,
    resolvedBy?: number
  ): Promise<Report | null> {
    const updateData: Partial<Report> = { status };
    if (resolvedBy) {
      updateData.resolvedBy = resolvedBy;
      updateData.resolvedAt = new Date();
    }

    const result = await db
      .update(reports)
      .set(updateData)
      .where(eq(reports.id, id))
      .returning();
    return result[0] || null;
  },

  async canUserReport(
    userId: number,
    postId?: number,
    commentId?: number
  ): Promise<boolean> {
    const conditions = [eq(reports.reporterId, userId)];

    if (postId) {
      conditions.push(eq(reports.postId, postId));
    }
    if (commentId) {
      conditions.push(eq(reports.commentId, commentId));
    }

    const existingReport = await db
      .select()
      .from(reports)
      .where(and(...conditions))
      .limit(1);

    return existingReport.length === 0;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(reports)
      .where(eq(reports.id, id))
      .returning();
    return result.length > 0;
  },
};

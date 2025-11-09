import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  communities,
  communityMembers,
  posts,
  users,
  type Community,
  type NewCommunity,
  type CommunityMember,
  type NewCommunityMember,
  type User,
} from '@/db/schema';

export const communityQueries = {
  async getAll(limit?: number, offset?: number): Promise<Community[]> {
    const baseQuery = db
      .select()
      .from(communities)
      .orderBy(desc(communities.memberCount));

    if (limit !== undefined && offset !== undefined) {
      return await baseQuery.limit(limit).offset(offset);
    } else if (limit !== undefined) {
      return await baseQuery.limit(limit);
    } else if (offset !== undefined) {
      return await baseQuery.offset(offset);
    } else {
      return await baseQuery;
    }
  },

  async getById(id: number): Promise<Community | null> {
    const result = await db
      .select()
      .from(communities)
      .where(eq(communities.id, id))
      .limit(1);
    return result[0] || null;
  },

  async getByName(name: string): Promise<Community | null> {
    const result = await db
      .select()
      .from(communities)
      .where(eq(communities.name, name))
      .limit(1);
    return result[0] || null;
  },

  async getPopular(limit = 10): Promise<Community[]> {
    return await db
      .select()
      .from(communities)
      .orderBy(desc(communities.memberCount))
      .limit(limit);
  },

  async create(data: NewCommunity): Promise<Community> {
    const result = await db.insert(communities).values(data).returning();
    return result[0];
  },

  async update(
    id: number,
    data: Partial<Community>
  ): Promise<Community | null> {
    const result = await db
      .update(communities)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(communities.id, id))
      .returning();
    return result[0] || null;
  },

  async isMember(userId: number, communityId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(communityMembers)
      .where(
        and(
          eq(communityMembers.userId, userId),
          eq(communityMembers.communityId, communityId)
        )
      )
      .limit(1);
    return result.length > 0;
  },

  async join(userId: number, communityId: number): Promise<CommunityMember> {
    // Check if already a member
    const existing = await this.isMember(userId, communityId);
    if (existing) {
      const result = await db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.userId, userId),
            eq(communityMembers.communityId, communityId)
          )
        )
        .limit(1);
      return result[0];
    }

    // Add member and increment member count
    const member = await db
      .insert(communityMembers)
      .values({ userId, communityId })
      .returning();

    await db
      .update(communities)
      .set({
        memberCount: sql`${communities.memberCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communities.id, communityId));

    return member[0];
  },

  async leave(userId: number, communityId: number): Promise<boolean> {
    const result = await db
      .delete(communityMembers)
      .where(
        and(
          eq(communityMembers.userId, userId),
          eq(communityMembers.communityId, communityId)
        )
      )
      .returning();

    if (result.length > 0) {
      await db
        .update(communities)
        .set({
          memberCount: sql`${communities.memberCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(communities.id, communityId));
      return true;
    }

    return false;
  },

  async getMemberCount(communityId: number): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(communityMembers)
      .where(eq(communityMembers.communityId, communityId));
    return Number(result[0]?.count || 0);
  },

  async getMembers(
    communityId: number,
    limit = 50,
    offset = 0
  ): Promise<Pick<User, 'id' | 'username' | 'email' | 'createdAt'>[]> {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(communityMembers)
      .innerJoin(users, eq(communityMembers.userId, users.id))
      .where(eq(communityMembers.communityId, communityId))
      .orderBy(desc(communityMembers.joinedAt))
      .limit(limit)
      .offset(offset);

    return result;
  },
};

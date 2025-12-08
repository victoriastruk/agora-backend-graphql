import { eq, desc, sql, and, like, or } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  communities,
  communityMembers,
  communityModerators,
  users,
  type Community,
  type NewCommunity,
  type CommunityMember,
  type CommunityModerator,
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

  async search(query: string, limit = 20, offset = 0): Promise<Community[]> {
    const searchPattern = `%${query}%`;
    return await db
      .select()
      .from(communities)
      .where(
        or(
          like(communities.name, searchPattern),
          like(communities.displayName, searchPattern)
        )
      )
      .orderBy(desc(communities.memberCount))
      .limit(limit)
      .offset(offset);
  },

  async isModerator(userId: number, communityId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(communityModerators)
      .where(
        and(
          eq(communityModerators.userId, userId),
          eq(communityModerators.communityId, communityId)
        )
      )
      .limit(1);
    return result.length > 0;
  },

  async isOwner(userId: number, communityId: number): Promise<boolean> {
    const result = await db
      .select()
      .from(communityModerators)
      .where(
        and(
          eq(communityModerators.userId, userId),
          eq(communityModerators.communityId, communityId),
          eq(communityModerators.role, 'owner')
        )
      )
      .limit(1);
    return result.length > 0;
  },

  async getModeratorRole(
    userId: number,
    communityId: number
  ): Promise<'owner' | 'moderator' | null> {
    const result = await db
      .select({ role: communityModerators.role })
      .from(communityModerators)
      .where(
        and(
          eq(communityModerators.userId, userId),
          eq(communityModerators.communityId, communityId)
        )
      )
      .limit(1);
    return result[0]?.role || null;
  },

  async addModerator(
    communityId: number,
    userId: number,
    role: 'owner' | 'moderator' = 'moderator'
  ): Promise<CommunityModerator> {
    const existing = await db
      .select()
      .from(communityModerators)
      .where(
        and(
          eq(communityModerators.userId, userId),
          eq(communityModerators.communityId, communityId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update role if already exists
      const updated = await db
        .update(communityModerators)
        .set({ role })
        .where(eq(communityModerators.id, existing[0].id))
        .returning();
      return updated[0];
    }

    const result = await db
      .insert(communityModerators)
      .values({ communityId, userId, role })
      .returning();
    return result[0];
  },

  async removeModerator(communityId: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(communityModerators)
      .where(
        and(
          eq(communityModerators.userId, userId),
          eq(communityModerators.communityId, communityId)
        )
      )
      .returning();
    return result.length > 0;
  },

  async getModerators(communityId: number): Promise<
    Array<{
      id: number;
      username: string;
      email: string;
      role: 'owner' | 'moderator';
    }>
  > {
    const result = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        role: communityModerators.role,
      })
      .from(communityModerators)
      .innerJoin(users, eq(communityModerators.userId, users.id))
      .where(eq(communityModerators.communityId, communityId))
      .orderBy(communityModerators.createdAt);
    return result;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(communities)
      .where(eq(communities.id, id))
      .returning();
    return result.length > 0;
  },
};

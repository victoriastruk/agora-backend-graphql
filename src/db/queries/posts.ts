import { eq, desc, sql, and, or, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  posts,
  postMedia,
  postFlairs,
  votes,
  comments,
  flairs,
  savedPosts,
  communities,
  users,
  type Post,
  type NewPost,
  type PostMedia,
  type NewPostMedia,
} from '@/db/schema';

export type PostWithRelations = Post & {
  community?: { id: number; name: string; displayName: string; iconUrl?: string | null };
  author?: { id: number; username: string };
  media?: PostMedia[];
  flairs?: Array<{ id: number; label: string; color?: string | null; backgroundColor?: string | null }>;
  userVote?: 'upvote' | 'downvote' | null;
  isSaved?: boolean;
};

export const postQueries = {
  async getAll(limit = 20, offset = 0): Promise<Post[]> {
    return await db
      .select()
      .from(posts)
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getById(id: number): Promise<Post | null> {
    const result = await db.select().from(posts).where(eq(posts.id, id)).limit(1);
    return result[0] || null;
  },

  async getByIdWithRelations(id: number, userId?: number): Promise<PostWithRelations | null> {
    const post = await this.getById(id);
    if (!post) return null;

    const [media, flairsData, userVote, isSaved] = await Promise.all([
      db.select().from(postMedia).where(eq(postMedia.postId, id)),
      db
        .select({
          id: flairs.id,
          label: flairs.label,
          color: flairs.color,
          backgroundColor: flairs.backgroundColor,
        })
        .from(postFlairs)
        .innerJoin(flairs, eq(flairs.id, postFlairs.flairId))
        .where(eq(postFlairs.postId, id)),
      userId
        ? db
            .select({ type: votes.type })
            .from(votes)
            .where(and(eq(votes.postId, id), eq(votes.userId, userId)))
            .limit(1)
        : Promise.resolve([]),
      userId
        ? db
            .select()
            .from(savedPosts)
            .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, id)))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return {
      ...post,
      media,
      flairs: flairsData,
      userVote: userVote[0]?.type || null,
      isSaved: isSaved.length > 0,
    };
  },

  async getByCommunity(communityId: number, limit = 20, offset = 0): Promise<Post[]> {
    return await db
      .select()
      .from(posts)
      .where(eq(posts.communityId, communityId))
      .orderBy(desc(posts.createdAt))
      .limit(limit)
      .offset(offset);
  },

  async getFeed(
    sort: 'best' | 'hot' | 'new' | 'rising' | 'top' = 'best',
    limit = 20,
    offset = 0,
    userId?: number
  ): Promise<Post[]> {
    let orderBy;
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    switch (sort) {
      case 'hot':
        // Hot: score weighted by time (posts from last 24 hours)
        orderBy = sql`(${posts.score} / (EXTRACT(EPOCH FROM (NOW() - ${posts.createdAt})) / 3600 + 2)) DESC`;
        break;
      case 'new':
        orderBy = desc(posts.createdAt);
        break;
      case 'rising':
        // Rising: posts with high score in last hour
        orderBy = sql`${posts.score} DESC`;
        break;
      case 'top':
        orderBy = desc(posts.score);
        break;
      case 'best':
      default:
        // Best: combination of score and comment count
        orderBy = sql`(${posts.score} * 2 + ${posts.commentCount}) DESC`;
        break;
    }

    return await db
      .select()
      .from(posts)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset);
  },

  async getTopStories(limit = 6): Promise<Post[]> {
    // Get top posts from last 24 hours
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await db
      .select()
      .from(posts)
      .where(gte(posts.createdAt, oneDayAgo))
      .orderBy(desc(posts.score))
      .limit(limit);
  },

  async create(data: NewPost): Promise<Post> {
    const result = await db.insert(posts).values(data).returning();
    return result[0];
  },

  async update(id: number, data: Partial<Post>): Promise<Post | null> {
    const result = await db
      .update(posts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(posts.id, id))
      .returning();
    return result[0] || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db.delete(posts).where(eq(posts.id, id)).returning();
    return result.length > 0;
  },

  async addMedia(postId: number, media: Omit<NewPostMedia, 'postId' | 'id' | 'createdAt'>[]): Promise<PostMedia[]> {
    if (media.length === 0) return [];
    const result = await db.insert(postMedia).values(media.map((m) => ({ ...m, postId }))).returning();
    return result;
  },

  async addFlairs(postId: number, flairIds: number[]): Promise<void> {
    if (flairIds.length === 0) return;
    await db.insert(postFlairs).values(flairIds.map((flairId) => ({ postId, flairId })));
  },

  async vote(postId: number, userId: number, voteType: 'upvote' | 'downvote'): Promise<void> {
    // Check if vote exists
    const existingVote = await db
      .select()
      .from(votes)
      .where(and(eq(votes.postId, postId), eq(votes.userId, userId)))
      .limit(1);

    if (existingVote.length > 0) {
      // Update existing vote
      if (existingVote[0].type === voteType) {
        // Remove vote if clicking same button
        await db.delete(votes).where(eq(votes.id, existingVote[0].id));
        await this.updateScore(postId, voteType === 'upvote' ? -1 : 1);
      } else {
        // Change vote
        await db
          .update(votes)
          .set({ type: voteType })
          .where(eq(votes.id, existingVote[0].id));
        await this.updateScore(postId, voteType === 'upvote' ? 2 : -2);
      }
    } else {
      // Create new vote
      await db.insert(votes).values({ postId, userId, type: voteType });
      await this.updateScore(postId, voteType === 'upvote' ? 1 : -1);
    }
  },

  async updateScore(postId: number, delta: number): Promise<void> {
    await db
      .update(posts)
      .set({ score: sql`${posts.score} + ${delta}` })
      .where(eq(posts.id, postId));
  },

  async incrementCommentCount(postId: number): Promise<void> {
    await db
      .update(posts)
      .set({ commentCount: sql`${posts.commentCount} + 1` })
      .where(eq(posts.id, postId));
  },

  async save(userId: number, postId: number): Promise<void> {
    const existing = await db
      .select()
      .from(savedPosts)
      .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(savedPosts).values({ userId, postId });
    }
  },

  async unsave(userId: number, postId: number): Promise<void> {
    await db
      .delete(savedPosts)
      .where(and(eq(savedPosts.userId, userId), eq(savedPosts.postId, postId)));
  },
};


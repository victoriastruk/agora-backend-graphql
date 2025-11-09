import { eq, desc, sql, and } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  comments,
  votes,
  users,
  type Comment,
  type NewComment,
} from '@/db/schema';
import { postQueries } from './posts';

export type CommentWithRelations = Comment & {
  author?: { id: number; username: string };
  replies?: CommentWithRelations[];
  userVote?: 'upvote' | 'downvote' | null;
};

export const commentQueries = {
  async getByPostId(
    postId: number,
    userId?: number,
    limit?: number,
    offset?: number
  ): Promise<CommentWithRelations[]> {
    const baseQuery = db
      .select()
      .from(comments)
      .where(eq(comments.postId, postId))
      .orderBy(desc(comments.createdAt));

    let allComments;
    if (limit !== undefined && offset !== undefined) {
      allComments = await baseQuery.limit(limit).offset(offset);
    } else if (limit !== undefined) {
      allComments = await baseQuery.limit(limit);
    } else if (offset !== undefined) {
      allComments = await baseQuery.offset(offset);
    } else {
      allComments = await baseQuery;
    }

    const commentMap = new Map<number, CommentWithRelations>();
    const rootComments: CommentWithRelations[] = [];

    const commentIds = allComments.map((c) => c.id);
    const userVotes =
      userId && commentIds.length > 0
        ? await db
            .select({ commentId: votes.commentId, type: votes.type })
            .from(votes)
            .where(
              and(
                sql`${votes.commentId} IS NOT NULL`,
                sql`${votes.commentId} IN (${sql.join(
                  commentIds.map((id) => sql`${id}`),
                  sql`, `
                )})`,
                eq(votes.userId, userId)
              )
            )
        : [];

    const voteMap = new Map<number, 'upvote' | 'downvote'>();
    userVotes.forEach((v) => {
      if (v.commentId) voteMap.set(v.commentId, v.type);
    });

    for (const comment of allComments) {
      const commentWithRelations: CommentWithRelations = {
        ...comment,
        userVote: voteMap.get(comment.id) || null,
        replies: [],
      };
      commentMap.set(comment.id, commentWithRelations);

      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId);
        if (parent) {
          parent.replies = parent.replies || [];
          parent.replies.push(commentWithRelations);
        }
      } else {
        rootComments.push(commentWithRelations);
      }
    }

    return rootComments;
  },

  async getById(id: number): Promise<Comment | null> {
    const result = await db
      .select()
      .from(comments)
      .where(eq(comments.id, id))
      .limit(1);
    return result[0] || null;
  },

  async create(data: NewComment): Promise<Comment> {
    const result = await db.insert(comments).values(data).returning();

    if (result[0]) {
      await postQueries.incrementCommentCount(result[0].postId);
    }

    return result[0];
  },

  async update(id: number, content: string): Promise<Comment | null> {
    const result = await db
      .update(comments)
      .set({ content, updatedAt: new Date() })
      .where(eq(comments.id, id))
      .returning();
    return result[0] || null;
  },

  async delete(id: number): Promise<boolean> {
    const result = await db
      .delete(comments)
      .where(eq(comments.id, id))
      .returning();
    return result.length > 0;
  },

  async vote(
    commentId: number,
    userId: number,
    voteType: 'upvote' | 'downvote'
  ): Promise<void> {
    const existingVote = await db
      .select()
      .from(votes)
      .where(and(eq(votes.commentId, commentId), eq(votes.userId, userId)))
      .limit(1);

    if (existingVote.length > 0) {
      if (existingVote[0].type === voteType) {
        await db.delete(votes).where(eq(votes.id, existingVote[0].id));
        await this.updateScore(commentId, voteType === 'upvote' ? -1 : 1);
      } else {
        await db
          .update(votes)
          .set({ type: voteType })
          .where(eq(votes.id, existingVote[0].id));
        await this.updateScore(commentId, voteType === 'upvote' ? 2 : -2);
      }
    } else {
      await db.insert(votes).values({ commentId, userId, type: voteType });
      await this.updateScore(commentId, voteType === 'upvote' ? 1 : -1);
    }
  },

  async updateScore(commentId: number, delta: number): Promise<void> {
    await db
      .update(comments)
      .set({ score: sql`${comments.score} + ${delta}` })
      .where(eq(comments.id, commentId));
  },
};

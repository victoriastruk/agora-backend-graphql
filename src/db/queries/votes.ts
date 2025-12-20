import { eq, and } from "drizzle-orm";
import { db } from "@/db/client";
import { votes } from "@/db/schema";

export const voteQueries = {
  async getUserVoteOnPost(userId: number, postId: number) {
    const result = await db
      .select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.postId, postId)))
      .limit(1);
    return result[0] || null;
  },

  async getUserVoteOnComment(userId: number, commentId: number) {
    const result = await db
      .select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.commentId, commentId)))
      .limit(1);
    return result[0] || null;
  },
};

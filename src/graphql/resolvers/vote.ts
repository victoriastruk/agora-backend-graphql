import { GraphQLError } from "graphql";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { postQueries } from "@/db/queries/posts";
import { commentQueries } from "@/db/queries/comments";
import { notificationQueries } from "@/db/queries/notifications";
import { pubsub, Events } from "../pubsub";
import { requireAuth, requireCommunityMembership, enrichPost, enrichComment } from "./helpers";
import { enrichNotification } from "./notification";
import type { GraphQLContext } from "../types";
import type { Comment } from "@/db/schema";

const UPVOTE_MILESTONES = new Set([10, 50, 100, 500, 1000]);

export const voteResolvers = {
  Mutation: {
    votePost: async (
      _: unknown,
      { postId, voteType }: { postId: string; voteType: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        const post = await postQueries.getById(parseInt(postId));
        if (!post) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        await requireCommunityMembership(userId, post.communityId);

        await postQueries.vote(parseInt(postId), userId, voteType as "upvote" | "downvote");

        const enrichedPost = await enrichPost(post, userId);

        // Publish subscription event
        pubsub.publish(Events.POST_VOTED, { postVoted: enrichedPost });

        // Trigger upvote milestone notification
        const updatedPost = await postQueries.getById(parseInt(postId));
        if (
          updatedPost &&
          updatedPost.authorId !== userId &&
          voteType === "upvote" &&
          UPVOTE_MILESTONES.has(updatedPost.score)
        ) {
          const actor = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          const actorName = actor[0]?.username ?? "Someone";
          const notification = await notificationQueries.create({
            userId: updatedPost.authorId,
            type: "upvote",
            actorId: userId,
            postId: updatedPost.id,
            message: `${actorName} upvoted your post "${updatedPost.title}" — it reached ${updatedPost.score} upvotes!`,
            isRead: false,
          });
          const enriched = await enrichNotification(notification);
          pubsub.publish(Events.NOTIFICATION_RECEIVED, {
            notificationReceived: { ...enriched, userId: updatedPost.authorId },
          });
        }

        return enrichedPost;
      } catch (error) {
        console.error("Error voting on post:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to vote on post", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    voteComment: async (
      _: unknown,
      { commentId, voteType }: { commentId: string; voteType: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        const comment = await commentQueries.getById(parseInt(commentId));
        if (!comment) {
          throw new GraphQLError("Comment not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        const post = await postQueries.getById(comment.postId);
        if (!post) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        await requireCommunityMembership(userId, post.communityId);

        await commentQueries.vote(parseInt(commentId), userId, voteType as "upvote" | "downvote");

        const enrichedComment = await enrichComment(
          comment as Comment & { replies?: Comment[] },
          userId
        );

        pubsub.publish(Events.COMMENT_VOTED, { commentVoted: enrichedComment });

        return enrichedComment;
      } catch (error) {
        console.error("Error voting on comment:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to vote on comment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },
};

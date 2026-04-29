import { GraphQLError } from "graphql";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { communityQueries } from "@/db/queries/communities";
import { postQueries } from "@/db/queries/posts";
import { commentQueries } from "@/db/queries/comments";
import { notificationQueries } from "@/db/queries/notifications";
import { pubsub, Events } from "../pubsub";
import { requireAuth, getUserId, requireCommunityMembership, enrichComment } from "./helpers";
import { enrichNotification } from "./notification";
import type { GraphQLContext } from "../types";
import type { Comment } from "@/db/schema";

export const commentResolvers = {
  Query: {
    comments: async (
      _: unknown,
      { postId, limit = 50, offset = 0 }: { postId: string; limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        const postComments = await commentQueries.getByPostId(
          parseInt(postId),
          userId,
          limit,
          offset
        );
        return Promise.all(
          postComments.map((comment) =>
            enrichComment(comment as Comment & { replies?: Comment[] }, userId)
          )
        );
      } catch (error) {
        console.error("Error fetching comments:", error);
        throw new GraphQLError("Failed to fetch comments", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    comment: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      try {
        const userId = getUserId(context);
        const comment = await commentQueries.getById(parseInt(id));
        if (!comment) return null;
        return enrichComment(comment as Comment & { replies?: Comment[] }, userId);
      } catch (error) {
        console.error("Error fetching comment:", error);
        throw new GraphQLError("Failed to fetch comment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    createComment: async (
      _: unknown,
      { input }: { input: { postId: string; content: string; parentId?: string } },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        const { postId, content, parentId } = input;
        const post = await postQueries.getById(parseInt(postId));
        if (!post) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "POST_NOT_FOUND" },
          });
        }

        await requireCommunityMembership(userId, post.communityId);

        const comment = await commentQueries.create({
          postId: parseInt(postId),
          authorId: userId,
          content,
          parentId: parentId ? parseInt(parentId) : null,
        });

        const enrichedComment = await enrichComment(
          comment as Comment & { replies?: Comment[] },
          userId
        );

        // Publish subscription event
        pubsub.publish(Events.COMMENT_ADDED, { commentAdded: enrichedComment });

        // Trigger notification for post author (comment) or parent comment author (reply)
        if (parentId) {
          const parentComment = await commentQueries.getById(parseInt(parentId));
          if (parentComment && parentComment.authorId !== userId) {
            const actor = await db.select().from(users).where(eq(users.id, userId)).limit(1);
            const actorName = actor[0]?.username ?? "Someone";
            const notification = await notificationQueries.create({
              userId: parentComment.authorId,
              type: "reply",
              actorId: userId,
              postId: parseInt(postId),
              commentId: comment.id,
              message: `${actorName} replied to your comment`,
              isRead: false,
            });
            const enriched = await enrichNotification(notification);
            pubsub.publish(Events.NOTIFICATION_RECEIVED, {
              notificationReceived: { ...enriched, userId: parentComment.authorId },
            });
          }
        } else if (post.authorId !== userId) {
          const actor = await db.select().from(users).where(eq(users.id, userId)).limit(1);
          const actorName = actor[0]?.username ?? "Someone";
          const notification = await notificationQueries.create({
            userId: post.authorId,
            type: "comment",
            actorId: userId,
            postId: parseInt(postId),
            commentId: comment.id,
            message: `${actorName} commented on your post "${post.title}"`,
            isRead: false,
          });
          const enriched = await enrichNotification(notification);
          pubsub.publish(Events.NOTIFICATION_RECEIVED, {
            notificationReceived: { ...enriched, userId: post.authorId },
          });
        }

        return enrichedComment;
      } catch (error) {
        console.error("Error creating comment:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to create comment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updateComment: async (
      _: unknown,
      { commentId, content }: { commentId: string; content: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Check if user is the author
        const existingComment = await commentQueries.getById(parseInt(commentId));
        if (!existingComment) {
          throw new GraphQLError("Comment not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        if (existingComment.authorId !== userId) {
          throw new GraphQLError("Only the author can update this comment", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        const comment = await commentQueries.update(parseInt(commentId), content);
        if (!comment) {
          throw new GraphQLError("Comment not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        return await enrichComment(comment as Comment & { replies?: Comment[] }, userId);
      } catch (error) {
        console.error("Error updating comment:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to update comment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    deleteComment: async (
      _: unknown,
      { commentId }: { commentId: string },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Check if user is the author
        const comment = await commentQueries.getById(parseInt(commentId));
        if (!comment) {
          throw new GraphQLError("Comment not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        // Get the post to check if user is a moderator
        const post = await postQueries.getById(comment.postId);
        const isMod = post ? await communityQueries.isModerator(userId, post.communityId) : false;

        if (comment.authorId !== userId && !isMod) {
          throw new GraphQLError("Not authorized to delete this comment", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        return await commentQueries.delete(parseInt(commentId));
      } catch (error) {
        console.error("Error deleting comment:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to delete comment", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Comment: {
    post: async (parent: { postId: number }) => {
      try {
        return await postQueries.getById(parent.postId);
      } catch (error) {
        console.error("Error fetching comment post:", error);
        return null;
      }
    },
  },
};

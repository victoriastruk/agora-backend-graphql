import { GraphQLError } from "graphql";
import { postQueries } from "@/db/queries/posts";
import { commentQueries } from "@/db/queries/comments";
import { pubsub, Events } from "../pubsub";
import { requireAuth, requireCommunityMembership, enrichPost, enrichComment } from "./helpers";
import type { GraphQLContext } from "../types";
import type { Comment } from "@/db/schema";

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

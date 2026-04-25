import { eq } from "drizzle-orm";
import { GraphQLError } from "graphql";
import { db } from "@/db/client";
import { postFlairs } from "@/db/schema";
import { communityQueries } from "@/db/queries/communities";
import { postQueries } from "@/db/queries/posts";
import { commentQueries } from "@/db/queries/comments";
import { pubsub, Events } from "../pubsub";
import {
  requireAuth,
  getUserId,
  requireCommunityMembership,
  enrichPost,
  enrichComment,
} from "./helpers";
import type { GraphQLContext } from "../types";
import type { Comment } from "@/db/schema";

export const postResolvers = {
  Query: {
    posts: async (
      _parent: unknown,
      {
        communityId,
        region: _region,
        sort,
        limit,
        offset,
      }: {
        communityId?: string;
        region?: string;
        sort?: string;
        limit?: number;
        offset?: number;
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        if (communityId) {
          const posts = await postQueries.getByCommunity(parseInt(communityId), limit, offset);
          return Promise.all(posts.map((post) => enrichPost(post, userId)));
        } else {
          const posts = await postQueries.getFeed(
            (sort as "best" | "hot" | "new" | "rising" | "top") || "best",
            limit,
            offset,
            userId
          );
          return Promise.all(posts.map((post) => enrichPost(post, userId)));
        }
      } catch (error) {
        console.error("Query.posts error:", error);
        throw new GraphQLError("Failed to fetch posts", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    post: async (_: unknown, { id }: { id: string }, context: GraphQLContext) => {
      try {
        const userId = getUserId(context);
        const post = await postQueries.getById(parseInt(id));
        if (!post) return null;
        return enrichPost(post, userId);
      } catch (error) {
        console.error("Error fetching post:", error);
        throw new GraphQLError("Failed to fetch post", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    feed: async (
      _: unknown,
      { sort = "best", limit = 20, offset = 0 }: { sort?: string; limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        const posts = await postQueries.getFeed(
          sort as "best" | "hot" | "new" | "rising" | "top",
          limit,
          offset,
          userId
        );
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error("Error fetching feed:", error);
        throw new GraphQLError("Failed to fetch feed", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    topStories: async (_: unknown, { limit = 6 }: { limit?: number }, context: GraphQLContext) => {
      try {
        const userId = getUserId(context);
        const posts = await postQueries.getTopStories(limit);
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error("Error fetching top stories:", error);
        throw new GraphQLError("Failed to fetch top stories", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    postsByCommunity: async (
      _: unknown,
      {
        communityId,
        limit = 20,
        offset = 0,
      }: { communityId: string; limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        const posts = await postQueries.getByCommunity(parseInt(communityId), limit, offset);
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error("Error fetching posts by community:", error);
        throw new GraphQLError("Failed to fetch posts by community", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    userPosts: async (
      _: unknown,
      { userId, limit = 20, offset = 0 }: { userId: string; limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const currentUserId = getUserId(context);
        const posts = await postQueries.getByAuthor(parseInt(userId), limit, offset);
        return Promise.all(posts.map((post) => enrichPost(post, currentUserId)));
      } catch (error) {
        console.error("Error fetching user posts:", error);
        throw new GraphQLError("Failed to fetch user posts", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    userComments: async (
      _: unknown,
      { userId, limit = 20, offset = 0 }: { userId: string; limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const currentUserId = getUserId(context);
        const userComments = await commentQueries.getByAuthor(parseInt(userId), limit, offset);
        return Promise.all(
          userComments.map((comment) =>
            enrichComment(comment as Comment & { replies?: Comment[] }, currentUserId)
          )
        );
      } catch (error) {
        console.error("Error fetching user comments:", error);
        throw new GraphQLError("Failed to fetch user comments", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    searchPosts: async (
      _: unknown,
      {
        query,
        communityId,
        limit = 20,
        offset = 0,
      }: {
        query: string;
        communityId?: string;
        limit?: number;
        offset?: number;
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        const posts = await postQueries.search(
          query,
          communityId ? parseInt(communityId) : undefined,
          limit,
          offset
        );
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error("Error searching posts:", error);
        throw new GraphQLError("Failed to search posts", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    savedPosts: async (
      _: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);
        const posts = await postQueries.getSavedByUser(userId, limit, offset);
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error("Error fetching saved posts:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to fetch saved posts", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Mutation: {
    createPost: async (
      _: unknown,
      {
        input,
      }: {
        input: {
          communityId: string;
          title: string;
          content?: string;
          type?: string;
          media?: Array<{
            type: string;
            url: string;
            thumbnailUrl?: string;
            width?: number;
            height?: number;
          }>;
          flairIds?: string[];
        };
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        const { communityId, title, content, type, media, flairIds } = input;
        const communityIdNum = parseInt(communityId);

        await requireCommunityMembership(userId, communityIdNum);

        const post = await postQueries.create({
          communityId: communityIdNum,
          authorId: userId,
          title,
          content,
          type: (type as "text" | "image" | "video" | "link" | "poll") || "text",
        });

        if (media && media.length > 0) {
          await postQueries.addMedia(post.id, media);
        }

        if (flairIds && flairIds.length > 0) {
          await postQueries.addFlairs(
            post.id,
            flairIds.map((id: string) => parseInt(id))
          );
        }

        const enrichedPost = await enrichPost(post, userId);

        // Publish subscription event
        pubsub.publish(Events.POST_ADDED, { postAdded: enrichedPost });

        return enrichedPost;
      } catch (error) {
        console.error("Error creating post:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to create post", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    updatePost: async (
      _: unknown,
      {
        postId,
        input,
      }: {
        postId: string;
        input: { title?: string; content?: string; flairIds?: string[] };
      },
      context: GraphQLContext
    ) => {
      try {
        const userId = requireAuth(context);

        // Check if user is the author of the post
        const post = await postQueries.getById(parseInt(postId));
        if (!post) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "POST_NOT_FOUND" },
          });
        }

        if (post.authorId !== userId) {
          throw new GraphQLError("Only the author can update this post", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        // Update the post
        const updatedPost = await postQueries.update(parseInt(postId), {
          title: input.title,
          content: input.content,
        });

        if (!updatedPost) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "POST_NOT_FOUND" },
          });
        }

        // Update flairs if provided
        if (input.flairIds) {
          await db.delete(postFlairs).where(eq(postFlairs.postId, parseInt(postId)));
          if (input.flairIds.length > 0) {
            await postQueries.addFlairs(
              parseInt(postId),
              input.flairIds.map((id: string) => parseInt(id))
            );
          }
        }

        const enrichedPost = await enrichPost(updatedPost, userId);

        // Publish POST_UPDATED subscription event
        pubsub.publish(Events.POST_UPDATED, { postUpdated: enrichedPost });

        return enrichedPost;
      } catch (error) {
        console.error("Error updating post:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to update post", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    deletePost: async (_: unknown, { postId }: { postId: string }, context: GraphQLContext) => {
      try {
        const userId = requireAuth(context);

        const post = await postQueries.getById(parseInt(postId));
        if (!post) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "POST_NOT_FOUND" },
          });
        }

        // Check if user is the author or a moderator of the community
        const isMod = await communityQueries.isModerator(userId, post.communityId);
        if (post.authorId !== userId && !isMod) {
          throw new GraphQLError("Not authorized to delete this post", {
            extensions: { code: "FORBIDDEN" },
          });
        }

        return await postQueries.delete(parseInt(postId));
      } catch (error) {
        console.error("Error deleting post:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to delete post", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    savePost: async (_: unknown, { postId }: { postId: string }, context: GraphQLContext) => {
      try {
        const userId = requireAuth(context);

        const post = await postQueries.getById(parseInt(postId));
        if (!post) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        await requireCommunityMembership(userId, post.communityId);

        await postQueries.save(userId, parseInt(postId));
        return true;
      } catch (error) {
        console.error("Error saving post:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to save post", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },

    unsavePost: async (_: unknown, { postId }: { postId: string }, context: GraphQLContext) => {
      try {
        const userId = requireAuth(context);

        const post = await postQueries.getById(parseInt(postId));
        if (!post) {
          throw new GraphQLError("Post not found", {
            extensions: { code: "NOT_FOUND" },
          });
        }

        await requireCommunityMembership(userId, post.communityId);

        await postQueries.unsave(userId, parseInt(postId));
        return true;
      } catch (error) {
        console.error("Error unsaving post:", error);
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Failed to unsave post", {
          extensions: { code: "INTERNAL_ERROR" },
        });
      }
    },
  },

  Post: {
    comments: async (
      parent: { id: number },
      { limit = 50, offset = 0 }: { limit?: number; offset?: number },
      context: GraphQLContext
    ) => {
      try {
        const userId = getUserId(context);
        return await commentQueries.getByPostId(parent.id, userId, limit, offset);
      } catch (error) {
        console.error("Error fetching post comments:", error);
        return [];
      }
    },
  },

  PostMedia: {
    thumb: (parent: { thumbnailUrl?: string }) => {
      return parent.thumbnailUrl;
    },
  },
};

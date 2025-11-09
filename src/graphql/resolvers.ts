import { eq, and } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, communities, votes, savedPosts, type User } from '@/db/schema';
import { communityQueries } from '@/db/queries/communities';
import { postQueries } from '@/db/queries/posts';
import { commentQueries } from '@/db/queries/comments';
import { voteQueries } from '@/db/queries/votes';
import { userQueries } from '@/db/queries/votes';
import { PubSub } from 'graphql-subscriptions';
import { withFilter } from 'graphql-subscriptions';

export const pubsub = new PubSub();

export const POST_ADDED = 'POST_ADDED';
export const POST_UPDATED = 'POST_UPDATED';
export const POST_VOTED = 'POST_VOTED';
export const COMMENT_ADDED = 'COMMENT_ADDED';
export const COMMENT_VOTED = 'COMMENT_VOTED';

// Helper для отримання userId з контексту
const getUserId = (context: any): number | undefined => {
  return context?.userId;
};

// Helper для обогащення поста з community та author
const enrichPost = async (post: any, userId?: number) => {
  const enrichedPost = await postQueries.getByIdWithRelations(post.id, userId);
  if (!enrichedPost) return null;

  const [community, author] = await Promise.all([
    db
      .select()
      .from(communities)
      .where(eq(communities.id, post.communityId))
      .limit(1),
    db.select().from(users).where(eq(users.id, post.authorId)).limit(1),
  ]);

  return {
    ...enrichedPost,
    community: community[0]
      ? {
          id: community[0].id,
          name: community[0].name,
          displayName: community[0].displayName,
          iconUrl: community[0].iconUrl,
          memberCount: community[0].memberCount,
          createdAt: community[0].createdAt,
          updatedAt: community[0].updatedAt,
          isJoined: userId
            ? await communityQueries.isMember(userId, community[0].id)
            : false,
        }
      : null,
    author: author[0]
      ? {
          id: author[0].id,
          username: author[0].username,
          email: author[0].email,
          createdAt: author[0].createdAt,
        }
      : null,
  };
};

// Helper для обогащення коментаря
const enrichComment = async (comment: any, userId?: number) => {
  const author = await db
    .select()
    .from(users)
    .where(eq(users.id, comment.authorId))
    .limit(1);

  // Обогатити replies рекурсивно
  const enrichedReplies =
    comment.replies && comment.replies.length > 0
      ? await Promise.all(
          comment.replies.map((reply: any) => enrichComment(reply, userId))
        )
      : [];

  return {
    ...comment,
    author: author[0]
      ? {
          id: author[0].id,
          username: author[0].username,
          email: author[0].email,
          createdAt: author[0].createdAt,
        }
      : null,
    replies: enrichedReplies,
  };
};

export const resolvers = {
  DateTime: {
    parseValue: (value: any) => new Date(value),
    serialize: (value: any) =>
      value instanceof Date ? value.toISOString() : value,
    parseLiteral: (ast: any) => {
      if (ast.kind === 'StringValue') {
        return new Date(ast.value);
      }
      return null;
    },
  },

  Query: {
    posts: async (
      _parent: any,
      { communityId, region, sort, limit, offset }: any,
      { userId }: any
    ) => {
      try {
        if (communityId) {
          // Get posts from specific community
          return await postQueries.getByCommunity(communityId, limit, offset);
        } else {
          // Get general posts feed
          return await postQueries.getFeed(
            sort || 'best',
            limit,
            offset,
            userId
          );
        }
      } catch (error) {
        console.error('Query.posts error:', error);
        throw new Error('Failed to fetch posts');
      }
    },
    // Users
    users: async (
      _: any,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number }
    ): Promise<Omit<User, 'passwordHash'>[]> => {
      try {
        const allUsers = await db
          .select()
          .from(users)
          .limit(limit)
          .offset(offset);
        return allUsers.map(({ passwordHash, ...user }) => user);
      } catch (error) {
        console.error('Error fetching users:', error);
        throw new Error('Failed to fetch users');
      }
    },

    user: async (
      _: any,
      { id }: { id: string }
    ): Promise<Omit<User, 'passwordHash'> | null> => {
      try {
        const result = await db
          .select()
          .from(users)
          .where(eq(users.id, parseInt(id)))
          .limit(1);
        if (!result[0]) return null;
        const { passwordHash, ...safeUser } = result[0];
        return safeUser;
      } catch (error) {
        console.error('Error fetching user:', error);
        throw new Error('Failed to fetch user');
      }
    },

    // Communities
    communities: async (
      _: any,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number }
    ) => {
      try {
        return await communityQueries.getAll(limit, offset);
      } catch (error) {
        console.error('Error fetching communities:', error);
        throw new Error('Failed to fetch communities');
      }
    },

    community: async (_: any, { id }: { id?: string }) => {
      try {
        if (!id) return null;
        return await communityQueries.getById(parseInt(id));
      } catch (error) {
        console.error('Error fetching community:', error);
        throw new Error('Failed to fetch community');
      }
    },

    communityByName: async (_: any, { name }: { name: string }) => {
      try {
        return await communityQueries.getByName(name);
      } catch (error) {
        console.error('Error fetching community by name:', error);
        throw new Error('Failed to fetch community');
      }
    },

    popularCommunities: async (_: any, { limit = 10 }: { limit?: number }) => {
      try {
        return await communityQueries.getPopular(limit);
      } catch (error) {
        console.error('Error fetching popular communities:', error);
        throw new Error('Failed to fetch popular communities');
      }
    },

    post: async (_: any, { id }: { id: string }, context: any) => {
      try {
        const userId = getUserId(context);
        const post = await postQueries.getById(parseInt(id));
        if (!post) return null;
        return enrichPost(post, userId);
      } catch (error) {
        console.error('Error fetching post:', error);
        throw new Error('Failed to fetch post');
      }
    },

    feed: async (
      _: any,
      {
        sort = 'best',
        limit = 20,
        offset = 0,
      }: { sort?: string; limit?: number; offset?: number },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        const posts = await postQueries.getFeed(
          sort as 'best' | 'hot' | 'new' | 'rising' | 'top',
          limit,
          offset,
          userId
        );
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error('Error fetching feed:', error);
        throw new Error('Failed to fetch feed');
      }
    },

    topStories: async (
      _: any,
      { limit = 6 }: { limit?: number },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        const posts = await postQueries.getTopStories(limit);
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error('Error fetching top stories:', error);
        throw new Error('Failed to fetch top stories');
      }
    },

    postsByCommunity: async (
      _: any,
      {
        communityId,
        limit = 20,
        offset = 0,
      }: { communityId: string; limit?: number; offset?: number },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        const posts = await postQueries.getByCommunity(
          parseInt(communityId),
          limit,
          offset
        );
        return Promise.all(posts.map((post) => enrichPost(post, userId)));
      } catch (error) {
        console.error('Error fetching posts by community:', error);
        throw new Error('Failed to fetch posts by community');
      }
    },

    // Comments
    comments: async (
      _: any,
      {
        postId,
        limit = 50,
        offset = 0,
      }: { postId: string; limit?: number; offset?: number },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        const comments = await commentQueries.getByPostId(
          parseInt(postId),
          userId,
          limit,
          offset
        );
        return Promise.all(
          comments.map((comment) => enrichComment(comment, userId))
        );
      } catch (error) {
        console.error('Error fetching comments:', error);
        throw new Error('Failed to fetch comments');
      }
    },

    comment: async (_: any, { id }: { id: string }, context: any) => {
      try {
        const userId = getUserId(context);
        const comment = await commentQueries.getById(parseInt(id));
        if (!comment) return null;
        return enrichComment(comment, userId);
      } catch (error) {
        console.error('Error fetching comment:', error);
        throw new Error('Failed to fetch comment');
      }
    },
  },

  Community: {
    members: async (
      parent: any,
      { limit = 50, offset = 0 }: { limit?: number; offset?: number }
    ) => {
      try {
        // Get community members - users who have joined this community
        return await communityQueries.getMembers(parent.id, limit, offset);
      } catch (error) {
        console.error('Error fetching community members:', error);
        throw new Error('Failed to fetch community members');
      }
    },
  },

  Post: {
    comments: async (
      parent: any,
      { limit = 50, offset = 0 }: { limit?: number; offset?: number },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        return await commentQueries.getByPostId(
          parent.id,
          userId,
          limit,
          offset
        );
      } catch (error) {
        console.error('Error fetching post comments:', error);
        throw new Error('Failed to fetch post comments');
      }
    },
  },

  PostMedia: {
    thumb: (parent: any) => {
      // thumb is an alias for thumbnailUrl
      return parent.thumbnailUrl;
    },
  },

  Mutation: {
    // Communities
    joinCommunity: async (
      _: any,
      { communityId }: { communityId: string },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');
        await communityQueries.join(userId, parseInt(communityId));
        return await communityQueries.getById(parseInt(communityId));
      } catch (error) {
        console.error('Error joining community:', error);
        throw new Error('Failed to join community');
      }
    },

    leaveCommunity: async (
      _: any,
      { communityId }: { communityId: string },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');
        return await communityQueries.leave(userId, parseInt(communityId));
      } catch (error) {
        console.error('Error leaving community:', error);
        throw new Error('Failed to leave community');
      }
    },

    // Posts
    createPost: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');

        const { communityId, title, content, type, media, flairIds } = input;
        const post = await postQueries.create({
          communityId: parseInt(communityId),
          authorId: userId,
          title,
          content,
          type: type || 'text',
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
        pubsub.publish(POST_ADDED, { postAdded: enrichedPost });

        return enrichedPost;
      } catch (error) {
        console.error('Error creating post:', error);
        throw new Error('Failed to create post');
      }
    },

    votePost: async (
      _: any,
      { postId, voteType }: { postId: string; voteType: string },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');

        await postQueries.vote(
          parseInt(postId),
          userId,
          voteType as 'upvote' | 'downvote'
        );
        const post = await postQueries.getById(parseInt(postId));
        if (!post) throw new Error('Post not found');

        const enrichedPost = await enrichPost(post, userId);

        // Publish subscription event
        pubsub.publish(POST_VOTED, { postVoted: enrichedPost });

        return enrichedPost;
      } catch (error) {
        console.error('Error voting on post:', error);
        throw new Error('Failed to vote on post');
      }
    },

    savePost: async (_: any, { postId }: { postId: string }, context: any) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');
        await postQueries.save(userId, parseInt(postId));
        return true;
      } catch (error) {
        console.error('Error saving post:', error);
        throw new Error('Failed to save post');
      }
    },

    unsavePost: async (
      _: any,
      { postId }: { postId: string },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');
        await postQueries.unsave(userId, parseInt(postId));
        return true;
      } catch (error) {
        console.error('Error unsaving post:', error);
        throw new Error('Failed to unsave post');
      }
    },

    // Comments
    createComment: async (_: any, { input }: { input: any }, context: any) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');

        const { postId, content, parentId } = input;
        const comment = await commentQueries.create({
          postId: parseInt(postId),
          authorId: userId,
          content,
          parentId: parentId ? parseInt(parentId) : null,
        });

        const enrichedComment = await enrichComment(comment, userId);

        // Publish subscription event
        pubsub.publish(COMMENT_ADDED, { commentAdded: enrichedComment });

        return enrichedComment;
      } catch (error) {
        console.error('Error creating comment:', error);
        throw new Error('Failed to create comment');
      }
    },

    voteComment: async (
      _: any,
      { commentId, voteType }: { commentId: string; voteType: string },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');

        await commentQueries.vote(
          parseInt(commentId),
          userId,
          voteType as 'upvote' | 'downvote'
        );
        const comment = await commentQueries.getById(parseInt(commentId));
        if (!comment) throw new Error('Comment not found');

        const enrichedComment = await enrichComment(comment, userId);

        // Publish subscription event
        pubsub.publish(COMMENT_VOTED, { commentVoted: enrichedComment });

        return enrichedComment;
      } catch (error) {
        console.error('Error voting on comment:', error);
        throw new Error('Failed to vote on comment');
      }
    },

    updateComment: async (
      _: any,
      { commentId, content }: { commentId: string; content: string },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');

        const comment = await commentQueries.update(
          parseInt(commentId),
          content
        );
        if (!comment) throw new Error('Comment not found');

        return await enrichComment(comment, userId);
      } catch (error) {
        console.error('Error updating comment:', error);
        throw new Error('Failed to update comment');
      }
    },

    deleteComment: async (
      _: any,
      { commentId }: { commentId: string },
      context: any
    ) => {
      try {
        const userId = getUserId(context);
        if (!userId) throw new Error('Unauthorized');
        return await commentQueries.delete(parseInt(commentId));
      } catch (error) {
        console.error('Error deleting comment:', error);
        throw new Error('Failed to delete comment');
      }
    },
  },

  Subscription: {
    postAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(POST_ADDED),
        (payload, variables) => {
          if (!variables.communityId) return true;
          return (
            payload.postAdded.community.id === parseInt(variables.communityId)
          );
        }
      ),
    },
    postUpdated: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(POST_UPDATED),
        (payload, variables) => {
          return payload.postUpdated.id === parseInt(variables.postId);
        }
      ),
    },
    postVoted: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(POST_VOTED),
        (payload, variables) => {
          return payload.postVoted.id === parseInt(variables.postId);
        }
      ),
    },
    commentAdded: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(COMMENT_ADDED),
        (payload, variables) => {
          return payload.commentAdded.postId === parseInt(variables.postId);
        }
      ),
    },
    commentVoted: {
      subscribe: withFilter(
        () => pubsub.asyncIterableIterator(COMMENT_VOTED),
        (payload, variables) => {
          return payload.commentVoted.id === parseInt(variables.commentId);
        }
      ),
    },
  },
};

import { Elysia, t } from 'elysia';
import { commentQueries } from '@/db/queries/comments';
import { users } from '@/db/schema';
import { db } from '@/db/client';
import { eq } from 'drizzle-orm';

export const commentsRoutes = new Elysia({ prefix: '/comments' })
  .get(
    '/post/:postId',
    async ({ params, query }) => {
      try {
        const postId = Number(params.postId);
        if (isNaN(postId)) {
          throw new Error('Invalid post ID');
        }

        const limit = Number(query?.limit) || 50;
        const offset = Number(query?.offset) || 0;

        // TODO: Get userId from auth token
        const userId = undefined; // Placeholder

        const comments = await commentQueries.getByPostId(
          postId,
          userId,
          limit,
          offset
        );

        // Enrich with author data
        const enrichedComments = await Promise.all(
          comments.map(async (comment) => {
            const author = await db
              .select()
              .from(users)
              .where(eq(users.id, comment.authorId))
              .limit(1);
            return {
              ...comment,
              author: author[0]
                ? { id: author[0].id, username: author[0].username }
                : null,
              replies: comment.replies
                ? await Promise.all(
                    comment.replies.map(async (reply) => {
                      const replyAuthor = await db
                        .select()
                        .from(users)
                        .where(eq(users.id, reply.authorId))
                        .limit(1);
                      return {
                        ...reply,
                        author: replyAuthor[0]
                          ? {
                              id: replyAuthor[0].id,
                              username: replyAuthor[0].username,
                            }
                          : null,
                      };
                    })
                  )
                : [],
            };
          })
        );

        return {
          success: true,
          data: enrichedComments,
          count: enrichedComments.length,
          limit,
          offset,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch comments');
      }
    },
    {
      detail: {
        summary: 'Get comments for post',
        description:
          'Retrieves paginated comments for a specific post in tree structure',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully retrieved comments',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { type: 'object' } },
                    count: { type: 'integer', example: 50 },
                    limit: { type: 'integer', example: 50 },
                    offset: { type: 'integer', example: 0 },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid post ID',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid post ID' },
                  },
                },
              },
            },
          },
        },
      },
      params: t.Object({
        postId: t.String(),
      }),
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
        offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
      }),
    }
  )
  .post(
    '/post/:postId',
    async ({ params, body }) => {
      try {
        const postId = Number(params.postId);
        if (isNaN(postId)) {
          throw new Error('Invalid post ID');
        }

        // TODO: Get userId from auth token
        const userId = 1; // Placeholder

        const { content, parentId } = body;

        const comment = await commentQueries.create({
          postId,
          authorId: userId,
          content,
          parentId: parentId || null,
        });

        return {
          success: true,
          message: 'Comment created successfully',
          data: comment,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to create comment');
      }
    },
    {
      detail: {
        summary: 'Create comment',
        description: 'Creates a new comment on a post',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Comment created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'Comment created successfully',
                    },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid post ID or input data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid post ID' },
                  },
                },
              },
            },
          },
        },
      },
      params: t.Object({
        postId: t.String(),
      }),
      body: t.Object({
        content: t.String({ minLength: 1 }),
        parentId: t.Optional(t.Number()),
      }),
    }
  )
  .put(
    '/:id/vote',
    async ({ params, body }) => {
      try {
        const commentId = Number(params.id);
        if (isNaN(commentId)) {
          throw new Error('Invalid comment ID');
        }

        // TODO: Get userId from auth token
        const userId = 1; // Placeholder

        const { voteType } = body;
        if (voteType !== 'upvote' && voteType !== 'downvote') {
          throw new Error('Invalid vote type');
        }

        await commentQueries.vote(commentId, userId, voteType);

        return {
          success: true,
          message: 'Vote recorded successfully',
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to vote on comment');
      }
    },
    {
      detail: {
        summary: 'Vote on comment',
        description: 'Upvote or downvote a comment',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Vote recorded successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'Vote recorded successfully',
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid comment ID or vote type',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid vote type' },
                  },
                },
              },
            },
          },
        },
      },
      params: t.Object({
        id: t.String(),
      }),
      body: t.Object({
        voteType: t.Union([t.Literal('upvote'), t.Literal('downvote')]),
      }),
    }
  );

import { Elysia, t } from 'elysia';
import { postQueries } from '@/db/queries/posts';
import { communities, users } from '@/db/schema';
import { db } from '@/db/client';
import { eq } from 'drizzle-orm';

export const postsRoutes = new Elysia({ prefix: '/posts' })
  .get(
    '/',
    async ({ query }) => {
      try {
        const limit = Number(query?.limit) || 20;
        const offset = Number(query?.offset) || 0;
        const posts = await postQueries.getAll(limit, offset);

        // Enrich with community and author data
        const enrichedPosts = await Promise.all(
          posts.map(async (post) => {
            const [community, author] = await Promise.all([
              db
                .select()
                .from(communities)
                .where(eq(communities.id, post.communityId))
                .limit(1),
              db
                .select()
                .from(users)
                .where(eq(users.id, post.authorId))
                .limit(1),
            ]);

            return {
              ...post,
              community: community[0]
                ? {
                    id: community[0].id,
                    name: community[0].name,
                    displayName: community[0].displayName,
                    iconUrl: community[0].iconUrl,
                  }
                : null,
              author: author[0]
                ? { id: author[0].id, username: author[0].username }
                : null,
            };
          })
        );

        return {
          success: true,
          data: enrichedPosts,
          count: enrichedPosts.length,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch posts');
      }
    },
    {
      detail: {
        summary: 'Get all posts',
        description: 'Retrieves a paginated list of all posts',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully retrieved posts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'array', items: { type: 'object' } },
                    count: { type: 'integer', example: 20 },
                  },
                },
              },
            },
          },
          500: {
            description: 'Internal server error',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Failed to fetch posts',
                    },
                  },
                },
              },
            },
          },
        },
      },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
        offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
      }),
    }
  )
  .get(
    '/:id',
    async ({ params }) => {
      try {
        const id = Number(params.id);
        if (isNaN(id)) {
          throw new Error('Invalid post ID');
        }

        // TODO: Get userId from auth token
        const userId = undefined; // Placeholder

        const post = await postQueries.getByIdWithRelations(id, userId);
        if (!post) {
          throw new Error('Post not found');
        }

        // Enrich with community and author data
        const [community, author] = await Promise.all([
          db
            .select()
            .from(communities)
            .where(eq(communities.id, post.communityId))
            .limit(1),
          db.select().from(users).where(eq(users.id, post.authorId)).limit(1),
        ]);

        return {
          success: true,
          data: {
            ...post,
            community: community[0]
              ? {
                  id: community[0].id,
                  name: community[0].name,
                  displayName: community[0].displayName,
                  iconUrl: community[0].iconUrl,
                }
              : null,
            author: author[0]
              ? { id: author[0].id, username: author[0].username }
              : null,
          },
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch post');
      }
    },
    {
      detail: {
        summary: 'Get post by ID',
        description: 'Retrieves a specific post with all relations',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully retrieved post',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: { type: 'object' },
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
          404: {
            description: 'Post not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Post not found' },
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
    }
  )
  .post(
    '/',
    async ({ body }) => {
      try {
        // TODO: Get userId from auth token
        const userId = 1; // Placeholder

        const { communityId, title, content, type, media, flairIds } = body;

        const post = await postQueries.create({
          communityId,
          authorId: userId,
          title,
          content,
          type: type || 'text',
        });

        // Add media if provided
        if (media && media.length > 0) {
          await postQueries.addMedia(
            post.id,
            media.map((m) => ({
              type: m.type,
              url: m.url,
              thumbnailUrl: m.thumbnailUrl || null,
              width: m.width || null,
              height: m.height || null,
            }))
          );
        }

        // Add flairs if provided
        if (flairIds && flairIds.length > 0) {
          await postQueries.addFlairs(post.id, flairIds);
        }

        return {
          success: true,
          message: 'Post created successfully',
          data: post,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to create post');
      }
    },
    {
      detail: {
        summary: 'Create post',
        description: 'Creates a new post',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Post created successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'Post created successfully',
                    },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid input data',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Invalid input data' },
                  },
                },
              },
            },
          },
        },
      },
      body: t.Object({
        communityId: t.Number(),
        title: t.String({ minLength: 1, maxLength: 300 }),
        content: t.Optional(t.String()),
        type: t.Optional(
          t.Union([
            t.Literal('text'),
            t.Literal('image'),
            t.Literal('video'),
            t.Literal('link'),
            t.Literal('poll'),
          ])
        ),
        media: t.Optional(
          t.Array(
            t.Object({
              type: t.String(),
              url: t.String(),
              thumbnailUrl: t.Optional(t.String()),
              width: t.Optional(t.Number()),
              height: t.Optional(t.Number()),
            })
          )
        ),
        flairIds: t.Optional(t.Array(t.Number())),
      }),
    }
  )
  .put(
    '/:id/vote',
    async ({ params, body }) => {
      try {
        const postId = Number(params.id);
        if (isNaN(postId)) {
          throw new Error('Invalid post ID');
        }

        // TODO: Get userId from auth token
        const userId = 1; // Placeholder

        const { voteType } = body;
        if (voteType !== 'upvote' && voteType !== 'downvote') {
          throw new Error('Invalid vote type');
        }

        await postQueries.vote(postId, userId, voteType);

        return {
          success: true,
          message: 'Vote recorded successfully',
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to vote on post');
      }
    },
    {
      detail: {
        summary: 'Vote on post',
        description: 'Upvote or downvote a post',
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
            description: 'Invalid post ID or vote type',
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
  )
  .post(
    '/:id/save',
    async ({ params }) => {
      try {
        const postId = Number(params.id);
        if (isNaN(postId)) {
          throw new Error('Invalid post ID');
        }

        // TODO: Get userId from auth token
        const userId = 1; // Placeholder

        await postQueries.save(userId, postId);

        return {
          success: true,
          message: 'Post saved successfully',
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to save post');
      }
    },
    {
      detail: {
        summary: 'Save post',
        description: 'Saves a post for later',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Post saved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'Post saved successfully',
                    },
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
        id: t.String(),
      }),
    }
  )
  .delete(
    '/:id/save',
    async ({ params }) => {
      try {
        const postId = Number(params.id);
        if (isNaN(postId)) {
          throw new Error('Invalid post ID');
        }

        // TODO: Get userId from auth token
        const userId = 1; // Placeholder

        await postQueries.unsave(userId, postId);

        return {
          success: true,
          message: 'Post unsaved successfully',
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to unsave post');
      }
    },
    {
      detail: {
        summary: 'Unsave post',
        description: 'Removes a post from saved posts',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Post unsaved successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'Post unsaved successfully',
                    },
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
        id: t.String(),
      }),
    }
  );

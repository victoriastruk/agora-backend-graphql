import { Elysia, t } from 'elysia';
import { postQueries } from '@/db/queries/posts';
import { communities, users } from '@/db/schema';
import { db } from '@/db/client';
import { eq } from 'drizzle-orm';

export const feedRoutes = new Elysia({ prefix: '/feed' }).get(
  '/',
  async ({ query }) => {
    try {
      const sort =
        (query?.sort as 'best' | 'hot' | 'new' | 'rising' | 'top') || 'best';
      const limit = Number(query?.limit) || 20;
      const offset = Number(query?.offset) || 0;

      // TODO: Get userId from auth token
      const userId = undefined; // Placeholder

      const posts = await postQueries.getFeed(sort, limit, offset, userId);

      // Enrich with community and author data
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          const [community, author] = await Promise.all([
            db
              .select()
              .from(communities)
              .where(eq(communities.id, post.communityId))
              .limit(1),
            db.select().from(users).where(eq(users.id, post.authorId)).limit(1),
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
        sort,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch feed');
    }
  },
  {
    detail: {
      summary: 'Get feed',
      description: 'Retrieves a paginated feed of posts with sorting options',
      hide: true, // Виключено з Swagger - використовуйте GraphQL
      responses: {
        200: {
          description: 'Successfully retrieved feed',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { type: 'array', items: { type: 'object' } },
                  count: { type: 'integer', example: 20 },
                  sort: { type: 'string', example: 'hot' },
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
                  message: { type: 'string', example: 'Failed to fetch feed' },
                },
              },
            },
          },
        },
      },
    },
    query: t.Object({
      sort: t.Optional(
        t.Union([
          t.Literal('best'),
          t.Literal('hot'),
          t.Literal('new'),
          t.Literal('rising'),
          t.Literal('top'),
        ])
      ),
      limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
      offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
    }),
  }
);

export const topStoriesRoutes = new Elysia({ prefix: '/top-stories' }).get(
  '/',
  async ({ query }) => {
    try {
      const limit = Number(query?.limit) || 6;
      const posts = await postQueries.getTopStories(limit);

      // Enrich with community and author data
      const enrichedPosts = await Promise.all(
        posts.map(async (post) => {
          const [community, author] = await Promise.all([
            db
              .select()
              .from(communities)
              .where(eq(communities.id, post.communityId))
              .limit(1),
            db.select().from(users).where(eq(users.id, post.authorId)).limit(1),
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
      throw new Error('Failed to fetch top stories');
    }
  },
  {
    detail: {
      summary: 'Get top stories',
      description: 'Retrieves top stories for hero carousel',
      hide: true, // Виключено з Swagger - використовуйте GraphQL
      responses: {
        200: {
          description: 'Successfully retrieved top stories',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  data: { type: 'array', items: { type: 'object' } },
                  count: { type: 'integer', example: 6 },
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
                    example: 'Failed to fetch top stories',
                  },
                },
              },
            },
          },
        },
      },
    },
    query: t.Object({
      limit: t.Optional(t.Number({ minimum: 1, maximum: 20, default: 6 })),
    }),
  }
);

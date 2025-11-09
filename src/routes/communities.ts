import { Elysia, t } from 'elysia';
import { communityQueries } from '@/db/queries/communities';

export const communitiesRoutes = new Elysia({ prefix: '/communities' })
  .get(
    '/',
    async ({ query }) => {
      try {
        const limit = Number(query?.limit) || 20;
        const offset = Number(query?.offset) || 0;

        const communities = await communityQueries.getAll(limit, offset);
        return {
          success: true,
          data: communities,
          count: communities.length,
          limit,
          offset,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch communities');
      }
    },
    {
      detail: {
        summary: 'Get all communities',
        description:
          'Retrieves a paginated list of all communities ordered by member count',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully retrieved communities',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { type: 'object' },
                    },
                    count: { type: 'integer', example: 20 },
                    limit: { type: 'integer', example: 20 },
                    offset: { type: 'integer', example: 0 },
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
                      example: 'Failed to fetch communities',
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
    '/popular',
    async ({ query }) => {
      try {
        const limit = Number(query?.limit) || 10;
        const communities = await communityQueries.getPopular(limit);
        return {
          success: true,
          data: communities,
          count: communities.length,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch popular communities');
      }
    },
    {
      detail: {
        summary: 'Get popular communities',
        description: 'Retrieves the most popular communities by member count',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully retrieved popular communities',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    data: {
                      type: 'array',
                      items: { type: 'object' },
                    },
                    count: { type: 'integer', example: 10 },
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
                      example: 'Failed to fetch popular communities',
                    },
                  },
                },
              },
            },
          },
        },
      },
      query: t.Object({
        limit: t.Optional(t.Number({ minimum: 1, maximum: 50, default: 10 })),
      }),
    }
  )
  .get(
    '/:id',
    async ({ params }) => {
      try {
        const id = Number(params.id);
        if (isNaN(id)) {
          throw new Error('Invalid community ID');
        }

        const community = await communityQueries.getById(id);
        if (!community) {
          throw new Error('Community not found');
        }

        return {
          success: true,
          data: community,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch community');
      }
    },
    {
      detail: {
        summary: 'Get community by ID',
        description: 'Retrieves a specific community by its ID',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully retrieved community',
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
            description: 'Invalid community ID',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Invalid community ID',
                    },
                  },
                },
              },
            },
          },
          404: {
            description: 'Community not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Community not found' },
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
  .get(
    '/name/:name',
    async ({ params }) => {
      try {
        const community = await communityQueries.getByName(params.name);
        if (!community) {
          throw new Error('Community not found');
        }

        return {
          success: true,
          data: community,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to fetch community');
      }
    },
    {
      detail: {
        summary: 'Get community by name',
        description: 'Retrieves a specific community by its name',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully retrieved community',
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
          404: {
            description: 'Community not found',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: { type: 'string', example: 'Community not found' },
                  },
                },
              },
            },
          },
        },
      },
      params: t.Object({
        name: t.String(),
      }),
    }
  )
  .post(
    '/:id/join',
    async ({ params, set, headers }) => {
      try {
        const communityId = Number(params.id);
        if (isNaN(communityId)) {
          throw new Error('Invalid community ID');
        }

        // TODO: Get userId from auth token
        const userId = 1; // Placeholder - should come from auth middleware

        const member = await communityQueries.join(userId, communityId);
        return {
          success: true,
          message: 'Successfully joined community',
          data: member,
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to join community');
      }
    },
    {
      detail: {
        summary: 'Join community',
        description: 'Adds the authenticated user to a community',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully joined community',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'Successfully joined community',
                    },
                    data: { type: 'object' },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid community ID',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'Invalid community ID',
                    },
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
    '/:id/leave',
    async ({ params }) => {
      try {
        const communityId = Number(params.id);
        if (isNaN(communityId)) {
          throw new Error('Invalid community ID');
        }

        // TODO: Get userId from auth token
        const userId = 1; // Placeholder - should come from auth middleware

        const success = await communityQueries.leave(userId, communityId);
        if (!success) {
          throw new Error('User is not a member of this community');
        }

        return {
          success: true,
          message: 'Successfully left community',
        };
      } catch (error) {
        if (error instanceof Error) {
          throw error;
        }
        throw new Error('Failed to leave community');
      }
    },
    {
      detail: {
        summary: 'Leave community',
        description: 'Removes the authenticated user from a community',
        hide: true, // Виключено з Swagger - використовуйте GraphQL
        responses: {
          200: {
            description: 'Successfully left community',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    message: {
                      type: 'string',
                      example: 'Successfully left community',
                    },
                  },
                },
              },
            },
          },
          400: {
            description: 'Invalid community ID or user not a member',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    message: {
                      type: 'string',
                      example: 'User is not a member of this community',
                    },
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

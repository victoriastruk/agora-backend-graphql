import { Elysia } from 'elysia';
import {
  API_VERSION,
  API_MESSAGE,
  HEALTH_STATUS_OK,
  ROUTES,
} from '@/constants/app';

export const healthRoutes = new Elysia()
  .get(
    ROUTES.HEALTH,
    () => ({
      status: HEALTH_STATUS_OK,
      timestamp: new Date().toISOString(),
    }),
    {
      detail: {
        summary: 'Health check',
        description:
          'Returns the current health status of the API and a timestamp. Useful for monitoring and load balancer health checks.',
        tags: ['Health'],
        responses: {
          200: {
            description: 'API is healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string', example: 'ok' },
                    timestamp: {
                      type: 'string',
                      format: 'date-time',
                      example: '2024-01-01T00:00:00.000Z',
                    },
                  },
                  required: ['status', 'timestamp'],
                },
              },
            },
          },
          405: {
            description: 'Method not allowed - only GET is supported',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Method Not Allowed' },
                    message: {
                      type: 'string',
                      example: 'Only GET method is allowed for this endpoint',
                    },
                  },
                  required: ['success', 'error', 'message'],
                },
              },
            },
          },
        },
      },
    }
  )
  .get(
    ROUTES.ROOT,
    () => ({
      message: API_MESSAGE,
      version: API_VERSION,
      docs: ROUTES.DOCS,
      graphql: ROUTES.GRAPHQL,
      health: ROUTES.HEALTH,
    }),
    {
      detail: {
        summary: 'API information',
        description:
          'Returns basic API information including version, message, and links to documentation, GraphQL endpoint, and health check endpoint.',
        tags: ['Health'],
        responses: {
          200: {
            description: 'API information',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Welcome to Reddit Backend API',
                    },
                    version: { type: 'string', example: '1.0.0' },
                    docs: { type: 'string', example: '/docs' },
                    graphql: { type: 'string', example: '/graphql' },
                    health: { type: 'string', example: '/health' },
                  },
                  required: ['message', 'version', 'docs', 'graphql', 'health'],
                },
              },
            },
          },
          405: {
            description: 'Method not allowed - only GET is supported',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: false },
                    error: { type: 'string', example: 'Method Not Allowed' },
                    message: {
                      type: 'string',
                      example: 'Only GET method is allowed for this endpoint',
                    },
                  },
                  required: ['success', 'error', 'message'],
                },
              },
            },
          },
        },
      },
    }
  )
  .all(ROUTES.HEALTH, ({ request, set }) => {
    if (request.method === 'GET') {
      return; // Let the GET handler handle it
    }
    set.status = 405;
    return {
      success: false,
      error: 'Method Not Allowed',
      message: 'Only GET method is allowed for this endpoint',
    };
  })
  .all(ROUTES.ROOT, ({ request, set }) => {
    if (request.method === 'GET') {
      return; // Let the GET handler handle it
    }
    set.status = 405;
    return {
      success: false,
      error: 'Method Not Allowed',
      message: 'Only GET method is allowed for this endpoint',
    };
  });

import { openapi } from '@elysiajs/openapi';
import { env } from '@/shared/config/env';
import * as z from 'zod';

export const openApiPlugin = openapi({
  exclude: {
    paths: ['/graphql', '/graphiql'],
  },
  documentation: {
    openapi: '3.0.0',
    info: {
      title: 'Reddit Backend API - Authentication',
      description:
        'REST API для автентифікації користувачів.\n\n⚠️ **Note**: Всі інші endpoints доступні через GraphQL API. Використовуйте GraphiQL Playground на `/graphql` для GraphQL API документації.',
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
      license: {
        name: 'MIT',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
    ],
    tags: [
      { name: 'Health', description: 'Health check and API info' },
      { name: 'Authentication', description: 'User registration and login' },
    ],
    security: [
      {
        bearerAuth: [],
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  mapJsonSchema: {
    zod: z.toJSONSchema,
  },
  path: '/docs',
  specPath: '/docs/json',
});

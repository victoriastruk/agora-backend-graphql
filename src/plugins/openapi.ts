import { openapi } from '@elysiajs/openapi';
import { env } from '@/shared/config/env';
import * as z from 'zod';

export const openApiPlugin = openapi({
  documentation: {
    openapi: '3.0.0',
    info: {
      title: 'Reddit Backend API',
      description:
        'Modern backend API built with Elysia.js, Drizzle ORM, and PostgreSQL. Provides user management, authentication, and health monitoring endpoints.',
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
      { name: 'Users', description: 'User CRUD operations' },
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
  path: '/swagger',
  specPath: '/swagger/json',
});

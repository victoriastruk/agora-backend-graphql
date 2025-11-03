import swagger from '@elysiajs/swagger';
import { env } from '@/shared/config/env';

export const swaggerPlugin = swagger({
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
  path: '/swagger',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
});

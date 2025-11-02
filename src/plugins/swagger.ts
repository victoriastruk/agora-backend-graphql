import swagger from '@elysiajs/swagger';
import { env } from '@/shared/config/env';

export const swaggerPlugin = swagger({
  documentation: {
    info: {
      title: 'Reddit Backend API',
      description:
        'Modern backend API built with Elysia.js, Drizzle ORM, and PostgreSQL',
      version: '1.0.0',
      contact: {
        name: 'API Support',
        email: 'support@example.com',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
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
  path: '/docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
  },
});

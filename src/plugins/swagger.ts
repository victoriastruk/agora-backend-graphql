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
      {
        name: 'Health',
        description: 'Health check and API information endpoints',
      },
      {
        name: 'Authentication',
        description:
          'User authentication endpoints including registration, login, logout, and session management',
      },
      {
        name: 'Users',
        description: 'User management endpoints for CRUD operations',
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
          description: 'JWT token for authentication',
        },
        sessionCookie: {
          type: 'apiKey',
          in: 'cookie',
          name: 'sessionId',
          description: 'Session ID stored in HTTP-only cookie',
        },
      },
      schemas: {
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
              description: 'Indicates if the request was successful',
            },
            error: {
              type: 'string',
              example: 'Validation Error',
              description: 'Error type or category',
            },
            message: {
              type: 'string',
              example: 'Invalid input data',
              description: 'Human-readable error message',
            },
            data: {
              type: 'object',
              nullable: true,
              description: 'Additional error data if available',
            },
            details: {
              type: 'string',
              example: 'Username must be at least 3 characters',
              description: 'Detailed validation error message',
            },
          },
          required: ['success'],
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
              description: 'Indicates if the request was successful',
            },
            message: {
              type: 'string',
              example: 'Operation completed successfully',
              description: 'Success message',
            },
            data: {
              type: 'object',
              description: 'Response data payload',
            },
          },
          required: ['success'],
        },
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
              description: 'Unique user identifier',
            },
            username: {
              type: 'string',
              example: 'john_doe',
              description: 'Unique username',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
              description: 'User email address',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
              description: 'Account creation timestamp',
            },
          },
          required: ['id', 'username', 'email', 'createdAt'],
        },
        UserListResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            data: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/User',
              },
            },
            count: {
              type: 'integer',
              example: 10,
              description: 'Total number of users',
            },
          },
          required: ['success', 'data', 'count'],
        },
        RegisterRequest: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 30,
              pattern: '^[a-zA-Z0-9_]+$',
              example: 'john_doe',
              description:
                'Username (3-30 characters, alphanumeric and underscore only)',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'john@example.com',
              description: 'Valid email address',
            },
            password: {
              type: 'string',
              minLength: 8,
              maxLength: 100,
              example: 'SecurePass123!',
              description: 'Password (8-100 characters)',
            },
          },
          required: ['username', 'email', 'password'],
        },
        LoginRequest: {
          type: 'object',
          properties: {
            usernameOrEmail: {
              type: 'string',
              minLength: 1,
              example: 'john_doe',
              description: 'Username or email address',
            },
            password: {
              type: 'string',
              minLength: 1,
              example: 'SecurePass123!',
              description: 'User password',
            },
          },
          required: ['usernameOrEmail', 'password'],
        },
        CreateUserRequest: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              example: 'newuser',
              description: 'Unique username (3-50 characters)',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'newuser@example.com',
              description: 'Valid email address',
            },
            passwordHash: {
              type: 'string',
              minLength: 8,
              example: 'hashed_password_string',
              description: 'Password hash (minimum 8 characters)',
            },
          },
          required: ['username', 'email', 'passwordHash'],
        },
        UpdateUserRequest: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              minLength: 3,
              maxLength: 50,
              example: 'updated_username',
              description: 'New username (3-50 characters)',
            },
            email: {
              type: 'string',
              format: 'email',
              example: 'updated@example.com',
              description: 'New email address',
            },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'ok',
              description: 'Health status',
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              example: '2024-01-01T00:00:00.000Z',
              description: 'Current server timestamp',
            },
          },
          required: ['status', 'timestamp'],
        },
        ApiInfoResponse: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              example: 'Reddit Backend API',
              description: 'API welcome message',
            },
            version: {
              type: 'string',
              example: '1.0.0',
              description: 'API version',
            },
            docs: {
              type: 'string',
              example: '/docs',
              description: 'Swagger documentation endpoint',
            },
            graphql: {
              type: 'string',
              example: '/graphql',
              description: 'GraphQL endpoint',
            },
            health: {
              type: 'string',
              example: '/health',
              description: 'Health check endpoint',
            },
          },
          required: ['message', 'version', 'docs', 'graphql', 'health'],
        },
      },
      responses: {
        BadRequest: {
          description: 'Bad request - validation error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                error: 'Validation Error',
                message: 'Invalid input data',
                details: 'Username must be at least 3 characters',
              },
            },
          },
        },
        Unauthorized: {
          description: 'Unauthorized - authentication required',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Not authenticated',
                data: null,
              },
            },
          },
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                error: 'Not Found',
                message: 'The requested resource was not found',
              },
            },
          },
        },
        Conflict: {
          description: 'Conflict - resource already exists',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                message: 'Username or email already exists',
                data: null,
              },
            },
          },
        },
        MethodNotAllowed: {
          description: 'HTTP method not allowed for this endpoint',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                error: 'Method Not Allowed',
                message: 'Only GET method is allowed for this endpoint',
              },
            },
          },
        },
        InternalServerError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ErrorResponse',
              },
              example: {
                success: false,
                error: 'Internal Server Error',
                message: 'Something went wrong on our end',
                data: null,
              },
            },
          },
        },
        Created: {
          description: 'Resource created successfully',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean', example: true },
                  message: {
                    type: 'string',
                    example: 'Resource created successfully',
                  },
                  data: {
                    type: 'object',
                    description: 'Created resource data',
                  },
                },
                required: ['success'],
              },
            },
          },
        },
        Success: {
          description: 'Request successful',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/SuccessResponse',
              },
            },
          },
        },
      },
    },
  },
  path: '/docs',
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    tryItOutEnabled: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
  },
});

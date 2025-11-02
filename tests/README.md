# Test Suite Documentation

This directory contains a comprehensive test suite for the Reddit Backend API, built using **Bun's built-in test runner** and following **Elysia's recommended testing patterns**.

## 📁 Directory Structure

```
tests/
├── unit/              # Unit tests for utilities and helpers
│   ├── auth.test.ts   # Authentication utility tests
│   └── logger.test.ts # Logger utility tests
├── integration/       # Integration tests for API routes
│   ├── auth.test.ts   # Authentication route tests
│   ├── users.test.ts  # User CRUD route tests
│   └── health.test.ts # Health check route tests
├── utils/             # Test utilities and helpers
│   ├── test-helpers.ts # Elysia app factory and test utilities
│   └── test-db.ts     # Database setup and utilities
├── setup.ts           # Global test setup and teardown
└── README.md          # This file
```

## 🚀 Running Tests

### Run All Tests

```bash
bun test
```

### Run Specific Test Suites

```bash
# Unit tests only
bun test tests/unit

# Integration tests only
bun test tests/integration

# Specific test file
bun test tests/integration/auth.test.ts
```

### Watch Mode

```bash
bun test --watch
```

### Coverage

```bash
bun test --coverage
```

## 🏗️ Test Architecture

### Test Database

The test suite uses **PostgreSQL** for integration tests, matching the production environment:

- Uses the same PostgreSQL database as production (typically via Docker)
- Tests use a separate test database connection for isolation
- Database tables are automatically created if they don't exist
- Clean database state between test runs via `clearTestDb()`

The test database utilities (`tests/utils/test-db.ts`) handle:

- Database setup and teardown
- Data seeding and cleanup
- Test user/session creation helpers

**Prerequisites**: Ensure PostgreSQL is running (via Docker Compose or locally) before running tests.

### Test Helpers

The `test-helpers.ts` file provides:

1. **`createTestApp()`** - Creates an Elysia app instance with all plugins and routes
2. **`testUtils.createAgent()`** - Creates an HTTP test agent using Elysia's `app.handle()` method
3. **`testUtils.parseResponse()`** - Parses response bodies (JSON or text)
4. **`testUtils.generateTestUser()`** - Generates unique test user data
5. **`testUtils.getCookie()`** - Extracts cookies from responses

### Following Elysia Patterns

Our tests follow Elysia's recommended testing approach:

1. **Using `app.handle()`** - We use Elysia's built-in request handling method
2. **Request/Response Objects** - Using native Web API `Request` and `Response` objects
3. **No External HTTP Server** - Tests run without starting an actual server
4. **Fast and Isolated** - Each test gets a fresh app instance

## 📝 Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';
import { AuthUtils } from '@/utils/auth';

describe('AuthUtils', () => {
  beforeEach(() => {
    // Reset mocks or state
  });

  it('should hash password correctly', async () => {
    const password = 'SecurePass123!';
    const hash = await AuthUtils.hashPassword(password);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(password);
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect, beforeEach, afterAll } from 'bun:test';
import { createTestApp, testUtils } from '../utils/test-helpers';
import { setupTestDb, teardownTestDb, clearTestDb } from '../utils/test-db';

describe('Users API', () => {
  let app: ReturnType<typeof createTestApp>;
  let agent: ReturnType<typeof testUtils.createAgent>;

  beforeEach(async () => {
    await setupTestDb();
    await clearTestDb();
    app = createTestApp();
    agent = testUtils.createAgent(app);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it('should create a user', async () => {
    const response = await agent.post('/users', {
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashed_password',
    });

    const data = await testUtils.parseResponse(response);
    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });
});
```

## 🔧 Test Utilities

### Database Helpers

```typescript
import {
  setupTestDb,
  teardownTestDb,
  clearTestDb,
  createTestUser,
  getTestUser,
  getAllTestUsers,
} from '../utils/test-db';

// Setup database (done in beforeEach)
await setupTestDb();

// Create test data
const user = await createTestUser({
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
});

// Cleanup (done in afterEach)
await clearTestDb();

// Teardown (done in afterAll)
await teardownTestDb();
```

### Test Agent

```typescript
import { createTestApp, testUtils } from '../utils/test-helpers';

const app = createTestApp();
const agent = testUtils.createAgent(app);

// Make requests
const response = await agent.get('/users');
const postResponse = await agent.post('/users', { username: 'test' });
const putResponse = await agent.put('/users/1', { email: 'new@example.com' });
const deleteResponse = await agent.delete('/users/1');

// Parse responses
const data = await testUtils.parseResponse(response);
```

## 🎯 Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up test data in `afterEach` or `afterAll`
3. **Descriptive Names**: Use clear, descriptive test names
4. **Arrange-Act-Assert**: Structure tests with clear setup, action, and assertions
5. **Mock External Services**: Mock Redis, external APIs, etc., in unit tests
6. **Use Real Database in Integration Tests**: Integration tests use a real PostgreSQL database

## 🐛 Debugging Tests

### Run Single Test

```bash
bun test tests/integration/auth.test.ts -t "should login successfully"
```

### Verbose Output

```bash
bun test --verbose
```

### Inspect Test Database

You can connect to the PostgreSQL test database directly using any PostgreSQL client:

```bash
# Using psql
psql postgresql://postgres:pass@localhost:5432/reddit-server

# Or using Docker
docker exec -it reddit-postgres psql -U postgres -d reddit-server
```

## 🔍 Test Coverage

The test suite covers:

### Unit Tests

- ✅ Authentication utilities (password hashing, session management)
- ✅ Logger utilities (logging methods, request tracking)

### Integration Tests

- ✅ Health check routes (`/`, `/health`)
- ✅ User CRUD operations (`/users`)
- ✅ Authentication routes (`/auth/register`, `/auth/login`, `/auth/logout`, `/auth/me`)

## 📚 Additional Resources

- [Bun Test Documentation](https://bun.sh/docs/cli/test)
- [Elysia Testing Guide](https://elysiajs.com/essential/testing.html)
- [Drizzle ORM Testing](https://orm.drizzle.team/docs/tests)

## 🤝 Contributing

When adding new features:

1. Write unit tests for new utilities
2. Write integration tests for new routes
3. Ensure all tests pass before submitting PRs
4. Maintain test coverage above 80%

## ⚠️ Notes

- Tests use PostgreSQL matching the production environment
- Ensure PostgreSQL is running before running tests (use `docker compose up -d` or start PostgreSQL locally)
- Redis is mocked in unit tests but can use real Redis in integration tests
- Test database connection is automatically set up and torn down
- Test database URL can be configured via `TEST_DATABASE_URL` environment variable
- Default test database uses the same connection as development: `postgresql://postgres:pass@localhost:5432/reddit-server`

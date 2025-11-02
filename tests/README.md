# Testing Suite

This project uses a comprehensive testing suite built with **Vitest** and **Bun** runtime, following Elysia's best testing practices. The suite includes unit tests for utilities and integration tests for API routes.

## 🏗️ Test Structure

```
tests/
├── setup.ts                    # Global test configuration and setup
├── utils/                      # Test utilities and helpers
│   ├── test-db.ts             # Database setup/teardown utilities
│   └── test-helpers.ts        # Common test helpers and mocks
├── unit/                      # Unit tests
│   ├── auth.test.ts          # Authentication utilities tests
│   └── logger.test.ts        # Logger utilities tests
├── integration/               # Integration tests
│   ├── users.test.ts         # Users API routes tests
│   └── health.test.ts        # Health check routes tests
└── README.md                 # This documentation
```

## 🚀 Running Tests

### Prerequisites

1. **Install dependencies:**
   ```bash
   bun install
   ```

2. **Set up test database:**
   The tests automatically use an in-memory SQLite database, so no additional setup is required.

### Test Commands

```bash
# Run all tests
bun run test

# Run tests in watch mode (re-runs on file changes)
bun run test:watch

# Run only unit tests
bun run test:unit

# Run only integration tests
bun run test:integration

# Run tests with coverage report
bun run test:coverage

# Run tests with UI (requires @vitest/ui)
bun run test:ui
```

### Environment Configuration

Tests use the `.env.test` file for configuration:

- **Database:** In-memory SQLite for fast, isolated testing
- **Redis:** Mocked for session management tests
- **JWT:** Test-specific secrets
- **CORS:** Localhost origins for testing

## 📋 Test Categories

### Unit Tests (`tests/unit/`)

Unit tests focus on individual functions and utilities without external dependencies.

#### AuthUtils Tests (`auth.test.ts`)
- Password hashing and verification
- Session ID generation
- Session management (create, get, destroy, extend)
- Redis integration mocking

#### Logger Tests (`logger.test.ts`)
- Logging methods (info, warn, error, debug)
- Request context tracking with AsyncLocalStorage
- Performance monitoring with timing
- HTTP request/response logging
- Database operation logging
- Application lifecycle logging

### Integration Tests (`tests/integration/`)

Integration tests verify complete request/response cycles through Elysia routes.

#### Users Routes Tests (`users.test.ts`)
- **GET /users** - List all users (with password hash exclusion)
- **GET /users/:id** - Get specific user by ID
- **POST /users** - Create new user with validation
- **PUT /users/:id** - Update user information
- **DELETE /users/:id** - Delete user

**Features tested:**
- CRUD operations
- Input validation (username length, email format)
- Unique constraint enforcement (username/email conflicts)
- Error handling (non-existent users, invalid IDs)
- Password hash exclusion from responses
- Database transaction integrity

#### Health Routes Tests (`health.test.ts`)
- **GET /** - API information endpoint
- **GET /health** - Health check with timestamp
- HTTP method validation
- Route availability testing

## 🛠️ Test Utilities

### Database Testing (`test-db.ts`)

```typescript
import { setupTestDb, teardownTestDb, clearTestDb, createTestUser } from './utils/test-db';

// Set up fresh database for each test
setupTestDb();

// Clean up after each test
teardownTestDb();

// Clear all data between tests
await clearTestDb();

// Create test data
const user = await createTestUser({
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashed_password'
});
```

### Test Helpers (`test-helpers.ts`)

```typescript
import { createTestApp, testUtils } from './utils/test-helpers';

// Create a test Elysia app
const app = createTestApp();

// Create request agent
const agent = testUtils.createAgent(app);

// Make requests
const response = await agent.get('/users');
const data = await testUtils.parseResponse(response);

// Generate test data
const userData = testUtils.generateTestUser();
```

### Mock Management

Tests use Vitest's mocking capabilities:

```typescript
import { vi } from 'vitest';

// Mock external services
vi.mock('@/db/redis', () => ({
  redis: {
    setex: vi.fn(),
    get: vi.fn(),
    del: vi.fn(),
  },
}));
```

## 🔄 Test Lifecycle

### Setup and Teardown

- **Global Setup:** Environment configuration, global mocks
- **Per-Test Setup:** Fresh database instance, cleared data
- **Per-Test Teardown:** Database cleanup, mock resets

### Database Isolation

Each test runs with:
- Fresh in-memory SQLite database
- Clean schema (migrations applied automatically)
- Isolated data (no cross-test contamination)
- Automatic cleanup after each test

## 📊 Coverage and Quality

### Coverage Goals

- **Unit Tests:** 90%+ coverage for utilities
- **Integration Tests:** 100% route coverage
- **Error Paths:** All error conditions tested

### Code Quality

- **Assertions:** Descriptive test names and clear assertions
- **Isolation:** No test dependencies on external state
- **Performance:** Fast execution with in-memory database
- **Maintainability:** Clear test structure and documentation

## 🐛 Debugging Tests

### Common Issues

1. **Database Connection Errors:**
   - Ensure `.env.test` is properly configured
   - Check that migrations run successfully

2. **Mock Issues:**
   - Clear mocks between tests: `vi.clearAllMocks()`
   - Verify mock implementations match actual usage

3. **Async Operations:**
   - Use `await` for all database operations
   - Ensure proper cleanup in `afterEach`

### Debugging Tips

```typescript
// Add debug logging
console.log('Test data:', testData);

// Inspect response details
console.log('Response status:', response.status);
console.log('Response data:', await response.text());

// Check database state
const users = await getAllTestUsers();
console.log('Database users:', users);
```

## 🚀 Extending Tests

### Adding Unit Tests

1. Create test file in `tests/unit/`
2. Import utilities to test
3. Write descriptive test cases
4. Mock external dependencies

### Adding Integration Tests

1. Create test file in `tests/integration/`
2. Use `createTestApp()` for app instance
3. Use `testUtils.createAgent()` for requests
4. Test complete request/response cycles

### Adding New Test Utilities

1. Add to `tests/utils/`
2. Export from appropriate modules
3. Document usage in this README

## 📈 CI/CD Integration

Tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions
- name: Run Tests
  run: bun run test:coverage

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

## 🔧 Configuration

### Vitest Configuration (`vitest.config.ts`)

- Node environment for server-side testing
- Global test functions enabled
- Path aliases configured
- Setup file for global configuration

### Environment Variables

Test-specific environment in `.env.test`:
- Isolated database (SQLite in-memory)
- Mocked external services
- Test-specific secrets

---

## 📚 Best Practices

- **Test Isolation:** Each test should be independent
- **Descriptive Names:** Clear test and suite names
- **Arrange-Act-Assert:** Follow AAA pattern
- **Mock Wisely:** Only mock external dependencies
- **Fast Feedback:** Keep tests fast and focused
- **Documentation:** Keep this README updated

For questions or issues with the test suite, check the test files for examples or create an issue in the repository.

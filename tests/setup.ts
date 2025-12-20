import { beforeAll, afterAll } from "bun:test";

// Set test environment
process.env.NODE_ENV = "test";

// Try to setup test database, but don't fail if it's not available
// Individual test files that need database will call setupTestDb themselves
beforeAll(async () => {
  // Database setup is handled per-test-file for better isolation
  // Some tests (like health tests) don't need database
});

afterAll(async () => {
  // Database teardown is handled per-test-file
});

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'bun:test';
import { createTestApp, testUtils } from '../../utils/test-helpers';
import {
  setupTestDb,
  teardownTestDb,
  clearTestDb,
  createTestUser,
} from '../../utils/test-db';

describe('GraphQL Users Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;
  let graphql: ReturnType<typeof testUtils.graphql>;

  beforeEach(async () => {
    await setupTestDb();
    await clearTestDb();
    app = createTestApp();
    graphql = testUtils.graphql(app);
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('Query.users', () => {
    it('should return empty array when no users exist', async () => {
      const response = await graphql.query(`
        query {
          users(limit: 10, offset: 0) {
            id
            username
            email
            createdAt
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toEqual([]);
    });

    it('should return users with pagination', async () => {
      // Create test users
      await createTestUser({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: 'hash1',
      });
      await createTestUser({
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: 'hash2',
      });

      const response = await graphql.query(`
        query {
          users(limit: 10, offset: 0) {
            id
            username
            email
            createdAt
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toHaveLength(2);
      expect(result.data.users[0]).toHaveProperty('username');
      expect(result.data.users[0]).toHaveProperty('email');
      expect(result.data.users[0]).not.toHaveProperty('passwordHash');
    });

    it('should respect pagination limits', async () => {
      // Create multiple users
      for (let i = 0; i < 5; i++) {
        await createTestUser({
          username: `user${i}`,
          email: `user${i}@example.com`,
          passwordHash: `hash${i}`,
        });
      }

      const response = await graphql.query(`
        query {
          users(limit: 2, offset: 0) {
            id
            username
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.users).toHaveLength(2);
    });
  });

  describe('Query.user', () => {
    it('should return user by ID', async () => {
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      const response = await graphql.query(
        `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
            username
            email
            createdAt
          }
        }
      `,
        { id: testUser.id.toString() }
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.user).toBeDefined();
      expect(result.data.user.username).toBe('testuser');
      expect(result.data.user.email).toBe('test@example.com');
      expect(result.data.user).not.toHaveProperty('passwordHash');
    });

    it('should return null for non-existent user', async () => {
      const response = await graphql.query(`
        query {
          user(id: "99999") {
            id
            username
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.user).toBeNull();
    });
  });

  describe('Query.searchUsers', () => {
    beforeEach(async () => {
      // Create test users for search
      await createTestUser({
        username: 'john_doe',
        email: 'john@example.com',
        passwordHash: 'hash1',
      });
      await createTestUser({
        username: 'jane_smith',
        email: 'jane@example.com',
        passwordHash: 'hash2',
      });
      await createTestUser({
        username: 'bob_johnson',
        email: 'bob@example.com',
        passwordHash: 'hash3',
      });
    });

    it('should search users by username', async () => {
      const response = await graphql.query(
        `
        query SearchUsers($query: String!) {
          searchUsers(query: $query, limit: 10) {
            id
            username
            email
          }
        }
      `,
        { query: 'john' }
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.searchUsers).toHaveLength(2);
      const usernames = result.data.searchUsers.map((u: any) => u.username);
      expect(usernames).toContain('john_doe');
      expect(usernames).toContain('bob_johnson');
    });

    it('should return empty array for no matches', async () => {
      const response = await graphql.query(`
        query {
          searchUsers(query: "nonexistent", limit: 10) {
            id
            username
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.searchUsers).toEqual([]);
    });

    it('should reject queries shorter than 2 characters', async () => {
      const response = await graphql.query(`
        query {
          searchUsers(query: "a", limit: 10) {
            id
            username
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain(
        'must be at least 2 characters'
      );
    });
  });

  describe('Mutation.updateUser', () => {
    let testUser: any;
    let authToken: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      // Login to get auth token (using REST API for auth)
      const loginResponse = await testUtils
        .createAgent(app)
        .post('/auth/login', {
          usernameOrEmail: 'testuser',
          password: 'TestPassword123!', // This should match the hash, but for testing we'll use a different approach
        });

      // For GraphQL testing, we'll create a JWT token manually
      const { AuthUtils } = await import('@/utils/auth');
      const session = await AuthUtils.createAuthSession(testUser);
      authToken = session.tokens.accessToken;
    });

    it('should update user profile', async () => {
      const response = await graphql.mutation(
        `
        mutation UpdateUser($userId: ID!, $input: UpdateUserInput!) {
          updateUser(userId: $userId, input: $input) {
            id
            username
            email
          }
        }
      `,
        {
          userId: testUser.id.toString(),
          input: {
            username: 'updated_username',
            email: 'updated@example.com',
          },
        },
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.updateUser.username).toBe('updated_username');
      expect(result.data.updateUser.email).toBe('updated@example.com');
    });

    it('should prevent updating other users', async () => {
      const otherUser = await createTestUser({
        username: 'otheruser',
        email: 'other@example.com',
        passwordHash: 'hash2',
      });

      const response = await graphql.mutation(
        `
        mutation {
          updateUser(userId: "${otherUser.id}", input: { username: "hacked" }) {
            id
          }
        }
      `,
        {},
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Unauthorized');
    });

    it('should prevent duplicate usernames', async () => {
      await createTestUser({
        username: 'existing_user',
        email: 'existing@example.com',
        passwordHash: 'hash3',
      });

      const response = await graphql.mutation(
        `
        mutation {
          updateUser(userId: "${testUser.id}", input: { username: "existing_user" }) {
            id
          }
        }
      `,
        {},
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Username already exists');
    });
  });

  describe('Mutation.deleteUser', () => {
    let testUser: any;
    let authToken: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      // Create JWT token for auth
      const { AuthUtils } = await import('@/utils/auth');
      const session = await AuthUtils.createAuthSession(testUser);
      authToken = session.tokens.accessToken;
    });

    it('should delete user account', async () => {
      const response = await graphql.mutation(
        `
        mutation DeleteUser($userId: ID!) {
          deleteUser(userId: $userId)
        }
      `,
        { userId: testUser.id.toString() },
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.deleteUser).toBe(true);

      // Verify user is deleted
      const checkResponse = await graphql.query(
        `
        query GetUser($id: ID!) {
          user(id: $id) {
            id
          }
        }
      `,
        { id: testUser.id.toString() }
      );

      const checkResult = await testUtils.parseGraphQLResponse(checkResponse);
      expect(checkResult.data.user).toBeNull();
    });

    it('should prevent deleting other users', async () => {
      const otherUser = await createTestUser({
        username: 'otheruser',
        email: 'other@example.com',
        passwordHash: 'hash2',
      });

      const response = await graphql.mutation(
        `
        mutation {
          deleteUser(userId: "${otherUser.id}")
        }
      `,
        {},
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Unauthorized');
    });
  });
});

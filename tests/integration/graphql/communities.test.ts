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
  createTestCommunity,
} from '../../utils/test-db';

describe('GraphQL Communities Integration Tests', () => {
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

  describe('Query.communities', () => {
    it('should return empty array when no communities exist', async () => {
      const response = await graphql.query(`
        query {
          communities(limit: 10, offset: 0) {
            id
            name
            displayName
            memberCount
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.communities).toEqual([]);
    });

    it('should return communities ordered by member count', async () => {
      await createTestCommunity({
        name: 'community1',
        displayName: 'Community 1',
        memberCount: 5,
      });
      await createTestCommunity({
        name: 'community2',
        displayName: 'Community 2',
        memberCount: 10,
      });

      const response = await graphql.query(`
        query {
          communities(limit: 10, offset: 0) {
            id
            name
            displayName
            memberCount
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.communities).toHaveLength(2);
      expect(result.data.communities[0].memberCount).toBe(10); // Higher member count first
      expect(result.data.communities[1].memberCount).toBe(5);
    });
  });

  describe('Query.community', () => {
    it('should return community by ID', async () => {
      const testCommunity = await createTestCommunity({
        name: 'testcommunity',
        displayName: 'Test Community',
        description: 'A test community',
        memberCount: 5,
      });

      const response = await graphql.query(
        `
        query GetCommunity($id: ID!) {
          community(id: $id) {
            id
            name
            displayName
            description
            memberCount
          }
        }
      `,
        { id: testCommunity.id.toString() }
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.community).toBeDefined();
      expect(result.data.community.name).toBe('testcommunity');
      expect(result.data.community.displayName).toBe('Test Community');
      expect(result.data.community.description).toBe('A test community');
    });

    it('should return null for non-existent community', async () => {
      const response = await graphql.query(`
        query {
          community(id: "99999") {
            id
            name
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.community).toBeNull();
    });
  });

  describe('Query.communityByName', () => {
    it('should return community by name', async () => {
      const testCommunity = await createTestCommunity({
        name: 'programming',
        displayName: 'Programming Community',
      });

      const response = await graphql.query(
        `
        query GetCommunityByName($name: String!) {
          communityByName(name: $name) {
            id
            name
            displayName
          }
        }
      `,
        { name: 'programming' }
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.communityByName.name).toBe('programming');
      expect(result.data.communityByName.displayName).toBe(
        'Programming Community'
      );
    });
  });

  describe('Query.popularCommunities', () => {
    it('should return top communities by member count', async () => {
      // Create communities with different member counts
      for (let i = 1; i <= 15; i++) {
        await createTestCommunity({
          name: `community${i}`,
          displayName: `Community ${i}`,
          memberCount: i,
        });
      }

      const response = await graphql.query(`
        query {
          popularCommunities(limit: 10) {
            id
            name
            memberCount
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.popularCommunities).toHaveLength(10);
      // Should be ordered by member count descending
      expect(result.data.popularCommunities[0].memberCount).toBe(15);
      expect(result.data.popularCommunities[9].memberCount).toBe(6);
    });

    it('should respect limit parameter', async () => {
      for (let i = 1; i <= 5; i++) {
        await createTestCommunity({
          name: `community${i}`,
          displayName: `Community ${i}`,
          memberCount: i,
        });
      }

      const response = await graphql.query(`
        query {
          popularCommunities(limit: 3) {
            id
            name
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.popularCommunities).toHaveLength(3);
    });
  });

  describe('Community.members', () => {
    it('should return community members', async () => {
      const testCommunity = await createTestCommunity({
        name: 'testcommunity',
        displayName: 'Test Community',
      });

      // Create test users and add them as members
      const user1 = await createTestUser({
        username: 'member1',
        email: 'member1@example.com',
        passwordHash: 'hash1',
      });
      const user2 = await createTestUser({
        username: 'member2',
        email: 'member2@example.com',
        passwordHash: 'hash2',
      });

      // Add users to community (this would normally be done through joinCommunity mutation)
      const { db } = await import('@/db/client');
      const { communityMembers } = await import('@/db/schema');
      await db.insert(communityMembers).values([
        { userId: user1.id, communityId: testCommunity.id },
        { userId: user2.id, communityId: testCommunity.id },
      ]);

      const response = await graphql.query(
        `
        query GetCommunityMembers($id: ID!) {
          community(id: $id) {
            id
            name
            members(limit: 10, offset: 0) {
              id
              username
              email
            }
          }
        }
      `,
        { id: testCommunity.id.toString() }
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.community.members).toHaveLength(2);
    });
  });

  describe('Mutation.createCommunity', () => {
    let authToken: string;

    beforeEach(async () => {
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
      });

      // Create JWT token for auth
      const { AuthUtils } = await import('@/utils/auth');
      const session = await AuthUtils.createAuthSession(testUser);
      authToken = session.tokens.accessToken;
    });

    it('should create a new community', async () => {
      const response = await graphql.mutation(
        `
        mutation CreateCommunity($input: CreateCommunityInput!) {
          createCommunity(input: $input) {
            id
            name
            displayName
            description
            memberCount
          }
        }
      `,
        {
          input: {
            name: 'newcommunity',
            displayName: 'New Community',
            description: 'A brand new community',
          },
        },
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.createCommunity).toBeDefined();
      expect(result.data.createCommunity.name).toBe('newcommunity');
      expect(result.data.createCommunity.displayName).toBe('New Community');
      expect(result.data.createCommunity.description).toBe(
        'A brand new community'
      );
      expect(result.data.createCommunity.memberCount).toBe(0);
    });

    it('should require authentication', async () => {
      const response = await graphql.mutation(`
        mutation {
          createCommunity(input: {
            name: "test"
            displayName: "Test"
          }) {
            id
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Not authenticated');
    });
  });

  describe('Mutation.joinCommunity', () => {
    let testUser: any;
    let testCommunity: any;
    let authToken: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
      });
      testCommunity = await createTestCommunity({
        name: 'testcommunity',
        displayName: 'Test Community',
        memberCount: 0,
      });

      // Create JWT token for auth
      const { AuthUtils } = await import('@/utils/auth');
      const session = await AuthUtils.createAuthSession(testUser);
      authToken = session.tokens.accessToken;
    });

    it('should join community successfully', async () => {
      const response = await graphql.mutation(
        `
        mutation JoinCommunity($communityId: ID!) {
          joinCommunity(communityId: $communityId) {
            id
            name
            memberCount
            isJoined
          }
        }
      `,
        { communityId: testCommunity.id.toString() },
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.joinCommunity.id).toBe(testCommunity.id.toString());
      expect(result.data.joinCommunity.memberCount).toBe(1);
      expect(result.data.joinCommunity.isJoined).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await graphql.mutation(`
        mutation {
          joinCommunity(communityId: "${testCommunity.id}") {
            id
          }
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Not authenticated');
    });

    it('should handle joining already joined community', async () => {
      // Join once
      await graphql.mutation(
        `
        mutation {
          joinCommunity(communityId: "${testCommunity.id}") {
            id
          }
        }
      `,
        {},
        authToken
      );

      // Try to join again
      const response = await graphql.mutation(
        `
        mutation {
          joinCommunity(communityId: "${testCommunity.id}") {
            id
            memberCount
          }
        }
      `,
        {},
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.joinCommunity.memberCount).toBe(1); // Should still be 1
    });
  });

  describe('Mutation.leaveCommunity', () => {
    let testUser: any;
    let testCommunity: any;
    let authToken: string;

    beforeEach(async () => {
      testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hash',
      });
      testCommunity = await createTestCommunity({
        name: 'testcommunity',
        displayName: 'Test Community',
        memberCount: 1,
      });

      // Create JWT token for auth
      const { AuthUtils } = await import('@/utils/auth');
      const session = await AuthUtils.createAuthSession(testUser);
      authToken = session.tokens.accessToken;

      // Add user to community
      const { db } = await import('@/db/client');
      const { communityMembers } = await import('@/db/schema');
      await db.insert(communityMembers).values({
        userId: testUser.id,
        communityId: testCommunity.id,
      });
    });

    it('should leave community successfully', async () => {
      const response = await graphql.mutation(
        `
        mutation LeaveCommunity($communityId: ID!) {
          leaveCommunity(communityId: $communityId)
        }
      `,
        { communityId: testCommunity.id.toString() },
        authToken
      );

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeUndefined();
      expect(result.data.leaveCommunity).toBe(true);
    });

    it('should require authentication', async () => {
      const response = await graphql.mutation(`
        mutation {
          leaveCommunity(communityId: "${testCommunity.id}")
        }
      `);

      const result = await testUtils.parseGraphQLResponse(response);
      expect(result.errors).toBeDefined();
      expect(result.errors[0].message).toContain('Not authenticated');
    });
  });
});

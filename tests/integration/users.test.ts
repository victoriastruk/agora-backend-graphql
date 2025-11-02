import { createTestApp, testUtils } from '../utils/test-helpers';
import {
  setupTestDb,
  teardownTestDb,
  clearTestDb,
  createTestUser,
  getAllTestUsers,
} from '../utils/test-db';

describe('Users Routes Integration Tests', () => {
  let app: ReturnType<typeof createTestApp>;
  let agent: ReturnType<typeof testUtils.createAgent>;

  beforeEach(async () => {
    await setupTestDb();
    await clearTestDb();

    app = createTestApp();
    agent = testUtils.createAgent(app);
  });

  afterEach(async () => {
    await clearTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('GET /users', () => {
    it('should return empty array when no users exist', async () => {
      const response = await agent.get('/users');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toEqual([]);
      expect(data.count).toBe(0);
    });

    it('should return all users without password hashes', async () => {
      await createTestUser({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: 'hashed_password_1',
      });
      await createTestUser({
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: 'hashed_password_2',
      });

      const response = await agent.get('/users');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.count).toBe(2);

      data.data.forEach((user: any) => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('createdAt');
      });
    });

    it('should handle database errors gracefully', async () => {
      await teardownTestDb();

      const response = await agent.get('/users');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);

      await setupTestDb();
    });
  });

  describe('GET /users/:id', () => {
    it('should return a specific user by ID', async () => {
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'hashed_password',
      });

      const response = await agent.get(`/users/${testUser.id}`);
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testUser.id);
      expect(data.data.username).toBe('testuser');
      expect(data.data.email).toBe('test@example.com');
      expect(data.data).not.toHaveProperty('passwordHash');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await agent.get('/users/999');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('User not found');
    });

    it('should return error for invalid user ID', async () => {
      const response = await agent.get('/users/invalid');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Invalid user ID');
    });
  });

  describe('POST /users', () => {
    it('should create a new user successfully', async () => {
      const newUser = testUtils.generateTestUser({
        username: 'newuser',
        email: 'newuser@example.com',
        passwordHash: 'plaintext_password',
      });

      const response = await agent.post('/users', {
        username: newUser.username,
        email: newUser.email,
        passwordHash: newUser.passwordHash,
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.username).toBe(newUser.username);
      expect(data.data.email).toBe(newUser.email);
      expect(data.data).not.toHaveProperty('passwordHash');
      expect(data.message).toBe('User created successfully');
    });

    it('should validate required fields', async () => {
      const response = await agent.post('/users', {});
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate username length', async () => {
      const response = await agent.post('/users', {
        username: 'ab',
        email: 'test@example.com',
        passwordHash: 'password123',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate email format', async () => {
      const response = await agent.post('/users', {
        username: 'testuser',
        email: 'invalid-email',
        passwordHash: 'password123',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should prevent duplicate usernames', async () => {
      const user1 = testUtils.generateTestUser({
        username: 'duplicate',
        email: 'user1@example.com',
      });

      await agent.post('/users', {
        username: user1.username,
        email: user1.email,
        passwordHash: 'password123',
      });

      const response = await agent.post('/users', {
        username: user1.username,
        email: 'user2@example.com',
        passwordHash: 'password123',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Username already exists');
    });

    it('should prevent duplicate emails', async () => {
      const user1 = testUtils.generateTestUser({
        username: 'user1',
        email: 'duplicate@example.com',
      });

      await agent.post('/users', {
        username: user1.username,
        email: user1.email,
        passwordHash: 'password123',
      });

      const response = await agent.post('/users', {
        username: 'user2',
        email: user1.email,
        passwordHash: 'password123',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Email already exists');
    });
  });

  describe('PUT /users/:id', () => {
    it('should update user information', async () => {
      const testUser = await createTestUser({
        username: 'originaluser',
        email: 'original@example.com',
        passwordHash: 'hashed_password',
      });

      const updateData = {
        username: 'updateduser',
        email: 'updated@example.com',
      };

      const response = await agent.put(`/users/${testUser.id}`, updateData);
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.username).toBe('updateduser');
      expect(data.data.email).toBe('updated@example.com');
      expect(data.message).toBe('User updated successfully');
    });

    it('should prevent username conflicts', async () => {
      const user1 = await createTestUser({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: 'password1',
      });
      const user2 = await createTestUser({
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: 'password2',
      });

      const response = await agent.put(`/users/${user1.id}`, {
        username: 'user2',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Username already exists');
    });

    it('should prevent email conflicts', async () => {
      const user1 = await createTestUser({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: 'password1',
      });
      const user2 = await createTestUser({
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: 'password2',
      });

      const response = await agent.put(`/users/${user1.id}`, {
        email: 'user2@example.com',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Email already exists');
    });

    it('should return error for non-existent user', async () => {
      const response = await agent.put('/users/999', {
        username: 'newname',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('User not found');
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete a user successfully', async () => {
      const testUser = await createTestUser({
        username: 'deleteme',
        email: 'delete@example.com',
        passwordHash: 'hashed_password',
      });

      const response = await agent.delete(`/users/${testUser.id}`);
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('User deleted successfully');
      expect(data.deletedCount).toBe(1);

      const allUsers = await getAllTestUsers();
      expect(allUsers).toHaveLength(0);
    });

    it('should return error for non-existent user', async () => {
      const response = await agent.delete('/users/999');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('User not found');
    });

    it('should return error for invalid user ID', async () => {
      const response = await agent.delete('/users/invalid');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Invalid user ID');
    });
  });
});

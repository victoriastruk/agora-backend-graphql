import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
} from 'bun:test';
import { createTestApp, testUtils } from '../utils/test-helpers';
import {
  setupTestDb,
  teardownTestDb,
  clearTestDb,
  createTestUser,
  getAllTestUsers,
} from '../utils/test-db';
import { AuthUtils } from '@/utils/auth';

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
      const passwordHash1 = await AuthUtils.hashPassword('password1');
      const passwordHash2 = await AuthUtils.hashPassword('password2');

      await createTestUser({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: passwordHash1,
      });
      await createTestUser({
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: passwordHash2,
      });

      const response = await agent.get('/users');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(2);
      expect(data.count).toBe(2);

      data.data.forEach((user: any) => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('password_hash');
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('createdAt');
      });
    });

    it('should handle large number of users', async () => {
      // Create multiple users
      const users = [];
      for (let i = 0; i < 10; i++) {
        const passwordHash = await AuthUtils.hashPassword(`password${i}`);
        users.push(
          createTestUser({
            username: `user${i}`,
            email: `user${i}@example.com`,
            passwordHash,
          })
        );
      }

      await Promise.all(users);

      const response = await agent.get('/users');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveLength(10);
      expect(data.count).toBe(10);
    });
  });

  describe('GET /users/:id', () => {
    it('should return a specific user by ID', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
      });

      const response = await agent.get(`/users/${testUser.id}`);
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe(testUser.id);
      expect(data.data.username).toBe('testuser');
      expect(data.data.email).toBe('test@example.com');
      expect(data.data).not.toHaveProperty('passwordHash');
      expect(data.data).not.toHaveProperty('password_hash');
    });

    it('should return 404 for non-existent user', async () => {
      const response = await agent.get('/users/99999');
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

    it('should return error for negative user ID', async () => {
      const response = await agent.get('/users/-1');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Invalid user ID');
    });

    it('should return error for zero user ID', async () => {
      const response = await agent.get('/users/0');
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('User not found');
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
        passwordHash: '',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.data.username).toBe(newUser.username);
      expect(data.data.email).toBe(newUser.email);
      expect(data.data).not.toHaveProperty('passwordHash');
      expect(data.message).toBe('User created successfully');
    });

    it('should hash password when creating user', async () => {
      const plainPassword = 'plaintext_password123';
      const newUser = testUtils.generateTestUser({
        username: 'hashtest',
        email: 'hashtest@example.com',
        passwordHash: plainPassword,
      });

      const response = await agent.post('/users', {
        username: newUser.username,
        email: newUser.email,
        passwordHash: plainPassword,
      });

      expect(response.status).toBe(201);

      const allUsers = await getAllTestUsers();
      const createdUser = allUsers.find((u) => u.username === newUser.username);
      expect(createdUser).toBeDefined();
      expect(createdUser?.passwordHash).not.toBe(plainPassword);
      expect(createdUser?.passwordHash.length).toBeGreaterThan(
        plainPassword.length
      );
    });

    it('should validate required fields', async () => {
      const response = await agent.post('/users', {});
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate username length (minimum)', async () => {
      const response = await agent.post('/users', {
        username: 'ab',
        email: 'test@example.com',
        passwordHash: 'password123',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate username length (maximum)', async () => {
      const longUsername = 'a'.repeat(51);
      const response = await agent.post('/users', {
        username: longUsername,
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

    it('should validate password hash length', async () => {
      const response = await agent.post('/users', {
        username: 'testuser',
        email: 'test@example.com',
        passwordHash: 'short',
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
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'originaluser',
        email: 'original@example.com',
        passwordHash,
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

    it('should update only username', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'originaluser',
        email: 'original@example.com',
        passwordHash,
      });

      const response = await agent.put(`/users/${testUser.id}`, {
        username: 'updateduser',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.username).toBe('updateduser');
      expect(data.data.email).toBe('original@example.com');
    });

    it('should update only email', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'originaluser',
        email: 'original@example.com',
        passwordHash,
      });

      const response = await agent.put(`/users/${testUser.id}`, {
        email: 'updated@example.com',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.username).toBe('originaluser');
      expect(data.data.email).toBe('updated@example.com');
    });

    it('should prevent username conflicts', async () => {
      const passwordHash1 = await AuthUtils.hashPassword('password1');
      const passwordHash2 = await AuthUtils.hashPassword('password2');

      const user1 = await createTestUser({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: passwordHash1,
      });
      const user2 = await createTestUser({
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: passwordHash2,
      });

      const response = await agent.put(`/users/${user1.id}`, {
        username: 'user2',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Username already exists');
    });

    it('should prevent email conflicts', async () => {
      const passwordHash1 = await AuthUtils.hashPassword('password1');
      const passwordHash2 = await AuthUtils.hashPassword('password2');

      const user1 = await createTestUser({
        username: 'user1',
        email: 'user1@example.com',
        passwordHash: passwordHash1,
      });
      const user2 = await createTestUser({
        username: 'user2',
        email: 'user2@example.com',
        passwordHash: passwordHash2,
      });

      const response = await agent.put(`/users/${user1.id}`, {
        email: 'user2@example.com',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('Email already exists');
    });

    it('should allow updating to same username', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
      });

      const response = await agent.put(`/users/${testUser.id}`, {
        username: 'testuser',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should allow updating to same email', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
      });

      const response = await agent.put(`/users/${testUser.id}`, {
        email: 'test@example.com',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return error for non-existent user', async () => {
      const response = await agent.put('/users/99999', {
        username: 'newname',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(500);
      expect(data.message).toContain('User not found');
    });

    it('should validate updated username format', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
      });

      const response = await agent.put(`/users/${testUser.id}`, {
        username: 'ab',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should validate updated email format', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'testuser',
        email: 'test@example.com',
        passwordHash,
      });

      const response = await agent.put(`/users/${testUser.id}`, {
        email: 'invalid-email',
      });
      const data = await testUtils.parseResponse(response);

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });
  });

  describe('DELETE /users/:id', () => {
    it('should delete a user successfully', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'deleteme',
        email: 'delete@example.com',
        passwordHash,
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
      const response = await agent.delete('/users/99999');
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

    it('should delete user and verify it no longer exists', async () => {
      const passwordHash = await AuthUtils.hashPassword('password123');
      const testUser = await createTestUser({
        username: 'tobedeleted',
        email: 'delete@example.com',
        passwordHash,
      });

      let allUsers = await getAllTestUsers();
      expect(allUsers).toHaveLength(1);

      const response = await agent.delete(`/users/${testUser.id}`);
      expect(response.status).toBe(200);

      allUsers = await getAllTestUsers();
      expect(allUsers).toHaveLength(0);

      const getResponse = await agent.get(`/users/${testUser.id}`);
      expect(getResponse.status).toBe(500);
    });
  });
});

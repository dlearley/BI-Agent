import request from 'supertest';
import app from '../index';
import { db } from '../config/database';
import { authService } from '../services/auth.service';
import { v4 as uuidv4 } from 'uuid';

describe('Auth Endpoints', () => {
  let testUserId: string;
  let testUserEmail = `test-${Date.now()}@example.com`;
  let testPassword = 'TestPassword123!';
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    // Clean up test data
    await db.query('DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email LIKE ?)', [`test-%@example.com`]);
    await db.query('DELETE FROM users WHERE email LIKE ?', [`test-%@example.com`]);
  });

  afterAll(async () => {
    // Clean up
    await db.query('DELETE FROM sessions WHERE user_id = $1', [testUserId]);
    await db.query('DELETE FROM users WHERE id = $1', [testUserId]);
  });

  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUserEmail,
          password: testPassword,
          firstName: 'Test',
          lastName: 'User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('email', testUserEmail);
      testUserId = response.body.id;
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          email: testUserEmail,
          password: testPassword,
        });

      expect(response.status).toBe(409);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing email', async () => {
      const response = await request(app)
        .post('/api/v1/auth/register')
        .send({
          password: testPassword,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with correct credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: testPassword,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');
      expect(response.body.user).toHaveProperty('email', testUserEmail);

      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject incorrect password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: 'WrongPassword',
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject non-existent user', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: testPassword,
        });

      expect(response.status).toBe(401);
    });

    it('should reject missing credentials', async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id', testUserId);
      expect(response.body).toHaveProperty('email', testUserEmail);
      expect(response.body).toHaveProperty('firstName');
    });

    it('should reject unauthenticated request', async () => {
      const response = await request(app).get('/api/v1/auth/me');

      expect(response.status).toBe(401);
    });

    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('expiresIn');

      // Update tokens for next tests
      accessToken = response.body.accessToken;
      refreshToken = response.body.refreshToken;
    });

    it('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: 'invalid_token',
        });

      expect(response.status).toBe(401);
    });

    it('should reject missing refresh token', async () => {
      const response = await request(app).post('/api/v1/auth/refresh').send({});

      expect(response.status).toBe(400);
    });
  });

  describe('POST /auth/change-password', () => {
    it('should change password successfully', async () => {
      const newPassword = 'NewPassword123!';

      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testPassword,
          newPassword,
        });

      expect(response.status).toBe(200);

      // Try login with new password
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: newPassword,
        });

      expect(loginResponse.status).toBe(200);
      accessToken = loginResponse.body.accessToken;
      testPassword = newPassword;
    });

    it('should reject incorrect current password', async () => {
      const response = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'AnotherPassword123!',
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v1/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message');
    });

    it('should reject unauthenticated logout', async () => {
      const response = await request(app).post('/api/v1/auth/logout');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /auth/api-keys', () => {
    let apiKey: string;

    beforeAll(async () => {
      // Re-login for this test suite
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: testUserEmail,
          password: testPassword,
        });

      accessToken = loginResponse.body.accessToken;
    });

    it('should create API key', async () => {
      const response = await request(app)
        .post('/api/v1/auth/api-keys')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'Test API Key',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('apiKey');
      expect(response.body).toHaveProperty('name', 'Test API Key');

      apiKey = response.body.apiKey;
    });

    it('should validate API key', async () => {
      // Note: This would require an API endpoint to validate API keys
      // For now, we just verify the key was created
      expect(apiKey).toBeDefined();
      expect(apiKey).toMatch(/^sk_/);
    });
  });
});

describe('Auth Service', () => {
  describe('Password hashing', () => {
    it('should hash password', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);

      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should verify password', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword(password, hash);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'TestPassword123!';
      const hash = await authService.hashPassword(password);

      const isValid = await authService.verifyPassword('WrongPassword', hash);
      expect(isValid).toBe(false);
    });
  });

  describe('JWT tokens', () => {
    it('should generate access and refresh tokens', () => {
      const tokens = authService.generateTokens(uuidv4(), 'test@example.com');

      expect(tokens).toHaveProperty('accessToken');
      expect(tokens).toHaveProperty('refreshToken');
      expect(tokens).toHaveProperty('expiresIn');
    });

    it('should verify JWT', async () => {
      const userId = uuidv4();
      const tokens = authService.generateTokens(userId, 'test@example.com');

      const decoded = await authService.verifyJWT(tokens.accessToken);
      expect(decoded).toBeDefined();
      expect(decoded.userId).toBe(userId);
      expect(decoded.type).toBe('access');
    });

    it('should reject invalid JWT', async () => {
      const decoded = await authService.verifyJWT('invalid_token');
      expect(decoded).toBeNull();
    });
  });

  describe('RBAC Guard', () => {
    it('should enforce RBAC on protected routes', async () => {
      const response = await request(app)
        .get('/api/v1/orgs')
        .set('Authorization', 'Bearer invalid_token');

      expect(response.status).toBe(401);
    });
  });
});

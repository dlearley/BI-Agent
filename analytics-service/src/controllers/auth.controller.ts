import { Request, Response } from 'express';
import { db } from '../config/database';
import { authService } from '../services/auth.service';
import { v4 as uuidv4 } from 'uuid';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuthController {
  async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      // Find user by email
      const user = await db.queryOne<any>(
        `SELECT id, email, password_hash, status, is_admin FROM users WHERE email = $1`,
        [email]
      );

      if (!user) {
        await authService.logAuthAction('login_failed', false, undefined, email, 'User not found');
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      if (user.status !== 'active') {
        await authService.logAuthAction('login_failed', false, user.id, email, `Account status: ${user.status}`);
        res.status(401).json({ error: 'Account is not active' });
        return;
      }

      // Verify password
      if (!user.password_hash || !(await authService.verifyPassword(password, user.password_hash))) {
        await authService.logAuthAction('login_failed', false, user.id, email, 'Invalid password');
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Generate tokens
      const userAgent = req.get('User-Agent');
      const ipAddress = this.getClientIP(req);
      const tokens = authService.generateTokens(user.id, user.email, undefined, user.is_admin ? 'admin' : 'user');

      // Create session
      const session = await authService.createSession(user.id, tokens, userAgent, ipAddress);

      // Update last login
      await db.query(
        `UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [user.id]
      );

      // Log successful login
      await authService.logAuthAction('login', true, user.id, user.email);

      res.json({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          isAdmin: user.is_admin,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  async logout(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      // Get session ID from request (could be stored in a cookie or header)
      const sessionId = req.headers['x-session-id'] as string;

      if (sessionId) {
        await authService.revokeSession(sessionId);
      }

      await authService.logAuthAction('logout', true, req.user.id, req.user.email);

      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  async refresh(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token required' });
        return;
      }

      // Decode refresh token to get user ID
      const decoded = await authService.verifyJWT(refreshToken);
      if (!decoded || decoded.type !== 'refresh') {
        await authService.logAuthAction('token_refresh', false, undefined, decoded?.email, 'Invalid refresh token');
        res.status(401).json({ error: 'Invalid refresh token' });
        return;
      }

      // Refresh tokens
      const newTokens = await authService.refreshAccessToken(decoded.userId, refreshToken);

      if (!newTokens) {
        await authService.logAuthAction('token_refresh', false, decoded.userId, decoded.email, 'Session expired or revoked');
        res.status(401).json({ error: 'Token refresh failed' });
        return;
      }

      await authService.logAuthAction('token_refresh', true, decoded.userId, decoded.email);

      res.json({
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        expiresIn: newTokens.expiresIn,
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Token refresh failed' });
    }
  }

  async register(req: Request, res: Response): Promise<void> {
    try {
      const { email, password, firstName, lastName } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email and password required' });
        return;
      }

      // Check if user exists
      const existingUser = await db.queryOne<any>(
        `SELECT id FROM users WHERE email = $1`,
        [email]
      );

      if (existingUser) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      // Hash password
      const passwordHash = await authService.hashPassword(password);

      // Create user
      const userId = uuidv4();
      await db.query(
        `INSERT INTO users (id, email, password_hash, first_name, last_name, status)
         VALUES ($1, $2, $3, $4, $5, 'active')`,
        [userId, email, passwordHash, firstName || null, lastName || null]
      );

      await authService.logAuthAction('register', true, userId, email);

      res.status(201).json({
        id: userId,
        email,
        message: 'User registered successfully',
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }

  async me(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await db.queryOne<any>(
        `SELECT id, email, first_name, last_name, is_admin, status, created_at, last_login_at
         FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isAdmin: user.is_admin,
        status: user.status,
        createdAt: user.created_at,
        lastLoginAt: user.last_login_at,
      });
    } catch (error) {
      console.error('Get me error:', error);
      res.status(500).json({ error: 'Failed to get user' });
    }
  }

  async changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({ error: 'Current password and new password required' });
        return;
      }

      // Get user with password hash
      const user = await db.queryOne<any>(
        `SELECT id, password_hash FROM users WHERE id = $1`,
        [req.user.id]
      );

      if (!user || !user.password_hash) {
        res.status(400).json({ error: 'Unable to verify current password' });
        return;
      }

      // Verify current password
      const isValid = await authService.verifyPassword(currentPassword, user.password_hash);
      if (!isValid) {
        await authService.logAuthAction('password_change', false, req.user.id, req.user.email, 'Invalid current password');
        res.status(401).json({ error: 'Current password is incorrect' });
        return;
      }

      // Hash new password
      const newPasswordHash = await authService.hashPassword(newPassword);

      // Update password
      await db.query(
        `UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [newPasswordHash, req.user.id]
      );

      // Revoke all sessions
      await authService.revokeUserSessions(req.user.id);

      await authService.logAuthAction('password_change', true, req.user.id, req.user.email);

      res.json({ message: 'Password changed successfully' });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({ error: 'Failed to change password' });
    }
  }

  async createAPIKey(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const { name, expiresIn } = req.body;

      if (!name) {
        res.status(400).json({ error: 'API key name required' });
        return;
      }

      let expiresAt: Date | undefined;
      if (expiresIn) {
        expiresAt = new Date(Date.now() + expiresIn * 1000);
      }

      const apiKey = await authService.createAPIKey(req.user.id, null, name, expiresAt);

      res.status(201).json({
        apiKey,
        name,
        expiresAt: expiresAt || null,
      });
    } catch (error) {
      console.error('Create API key error:', error);
      res.status(500).json({ error: 'Failed to create API key' });
    }
  }

  private getClientIP(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}

export const authController = new AuthController();

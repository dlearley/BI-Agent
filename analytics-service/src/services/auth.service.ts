import bcryptjs from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import config from '../config';
import crypto from 'crypto';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface UserSession {
  id: string;
  userId: string;
  tokenHash: string;
  refreshTokenHash: string;
  expiresAt: Date;
  refreshExpiresAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const salt = await bcryptjs.genSalt(10);
    return bcryptjs.hash(password, salt);
  }

  async verifyPassword(password: string, passwordHash: string): Promise<boolean> {
    return bcryptjs.compare(password, passwordHash);
  }

  generateTokens(userId: string, email: string, orgId?: string, role?: string): TokenPair {
    const accessTokenExpiration = '15m';
    const refreshTokenExpiration = '7d';

    const accessToken = jwt.sign(
      {
        userId,
        email,
        orgId,
        role: role || 'user',
        type: 'access',
      },
      config.jwt.secret,
      { expiresIn: accessTokenExpiration }
    );

    const refreshToken = jwt.sign(
      {
        userId,
        email,
        type: 'refresh',
      },
      config.jwt.secret,
      { expiresIn: refreshTokenExpiration }
    );

    // Get expiration times
    const now = new Date();
    const accessTokenExpires = jwt.decode(accessToken) as any;
    const refreshTokenExpires = jwt.decode(refreshToken) as any;

    return {
      accessToken,
      refreshToken,
      expiresIn: (accessTokenExpires.exp - Math.floor(now.getTime() / 1000)) * 1000,
    };
  }

  async createSession(
    userId: string,
    tokens: TokenPair,
    userAgent?: string,
    ipAddress?: string
  ): Promise<UserSession> {
    const sessionId = uuidv4();
    const tokenHash = this.hashTokenForStorage(tokens.accessToken);
    const refreshTokenHash = this.hashTokenForStorage(tokens.refreshToken);

    // Calculate expiry times
    const now = new Date();
    const accessTokenExpires = jwt.decode(tokens.accessToken) as any;
    const refreshTokenExpires = jwt.decode(tokens.refreshToken) as any;

    const expiresAt = new Date(accessTokenExpires.exp * 1000);
    const refreshExpiresAt = new Date(refreshTokenExpires.exp * 1000);

    await db.query(
      `INSERT INTO sessions (id, user_id, token_hash, refresh_token_hash, user_agent, ip_address, expires_at, refresh_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [sessionId, userId, tokenHash, refreshTokenHash, userAgent, ipAddress, expiresAt, refreshExpiresAt]
    );

    return {
      id: sessionId,
      userId,
      tokenHash,
      refreshTokenHash,
      expiresAt,
      refreshExpiresAt,
      userAgent,
      ipAddress,
    };
  }

  async validateSession(sessionId: string, token: string): Promise<boolean> {
    const tokenHash = this.hashTokenForStorage(token);

    const session = await db.queryOne<any>(
      `SELECT * FROM sessions 
       WHERE id = $1 AND token_hash = $2 AND expires_at > CURRENT_TIMESTAMP AND revoked_at IS NULL`,
      [sessionId, tokenHash]
    );

    return !!session;
  }

  async refreshAccessToken(userId: string, refreshToken: string): Promise<TokenPair | null> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, config.jwt.secret) as any;

      if (decoded.type !== 'refresh' || decoded.userId !== userId) {
        return null;
      }

      // Check if refresh token session exists and is valid
      const refreshTokenHash = this.hashTokenForStorage(refreshToken);
      const session = await db.queryOne<any>(
        `SELECT * FROM sessions 
         WHERE user_id = $1 AND refresh_token_hash = $2 AND refresh_expires_at > CURRENT_TIMESTAMP AND revoked_at IS NULL`,
        [userId, refreshTokenHash]
      );

      if (!session) {
        return null;
      }

      // Get user info for new token
      const user = await db.queryOne<any>(
        `SELECT id, email FROM users WHERE id = $1`,
        [userId]
      );

      if (!user) {
        return null;
      }

      // Generate new tokens
      return this.generateTokens(user.id, user.email);
    } catch (error) {
      return null;
    }
  }

  async revokeSession(sessionId: string): Promise<void> {
    await db.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [sessionId]
    );
  }

  async revokeUserSessions(userId: string): Promise<void> {
    await db.query(
      `UPDATE sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    );
  }

  async createAPIKey(
    userId: string,
    orgId: string | null,
    name: string,
    expiresAt?: Date
  ): Promise<string> {
    const apiKey = this.generateAPIKey();
    const keyHash = this.hashTokenForStorage(apiKey);

    await db.query(
      `INSERT INTO api_keys (id, user_id, org_id, name, key_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [uuidv4(), userId, orgId, name, keyHash, expiresAt || null]
    );

    return apiKey;
  }

  async validateAPIKey(apiKey: string): Promise<{ userId: string; orgId?: string } | null> {
    const keyHash = this.hashTokenForStorage(apiKey);

    const result = await db.queryOne<any>(
      `SELECT user_id, org_id FROM api_keys 
       WHERE key_hash = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)`,
      [keyHash]
    );

    return result ? { userId: result.user_id, orgId: result.org_id } : null;
  }

  async logAuthAction(
    action: string,
    success: boolean,
    userId?: string,
    email?: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await db.query(
        `INSERT INTO auth_logs (id, user_id, email, action, success, reason, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [uuidv4(), userId || null, email || null, action, success, reason || null, ipAddress, userAgent]
      );
    } catch (error) {
      console.error('Failed to log auth action:', error);
    }
  }

  private hashTokenForStorage(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private generateAPIKey(): string {
    return `sk_${crypto.randomBytes(32).toString('hex')}`;
  }

  async verifyJWT(token: string): Promise<any> {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (error) {
      return null;
    }
  }
}

export const authService = new AuthService();

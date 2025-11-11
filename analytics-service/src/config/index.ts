import { AppConfig } from '../types';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const config: AppConfig = {
  database: {
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'analytics_db',
    user: process.env.DATABASE_USER || 'username',
    password: process.env.DATABASE_PASSWORD || 'password',
    ssl: process.env.NODE_ENV === 'production',
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    db: parseInt(process.env.REDIS_DB || '0'),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
  hipaa: {
    enabled: process.env.HIPAA_MODE === 'true',
    minThreshold: parseInt(process.env.HIPAA_MIN_THRESHOLD || '5'),
  },
  analytics: {
    refreshInterval: parseInt(process.env.ANALYTICS_REFRESH_INTERVAL || '3600000'),
    cacheTTL: parseInt(process.env.ANALYTICS_CACHE_TTL || '300'),
  },
};

export default config;
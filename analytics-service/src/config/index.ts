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
  mlService: {
    url: process.env.ML_SERVICE_URL || 'http://localhost:8000',
    timeout: parseInt(process.env.ML_SERVICE_TIMEOUT || '30000'),
  },
  exports: {
    s3: {
      bucket: process.env.S3_BUCKET || 'analytics-exports',
      region: process.env.S3_REGION || 'us-east-1',
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
      endpoint: process.env.S3_ENDPOINT, // Optional for S3-compatible services
    },
    email: {
      smtpHost: process.env.SMTP_HOST || 'localhost',
      smtpPort: parseInt(process.env.SMTP_PORT || '587'),
      smtpUser: process.env.SMTP_USER || '',
      smtpPassword: process.env.SMTP_PASSWORD || '',
      fromEmail: process.env.FROM_EMAIL || 'analytics@example.com',
      fromName: process.env.FROM_NAME || 'Analytics Service',
    },
    slack: {
      botToken: process.env.SLACK_BOT_TOKEN || '',
      signingSecret: process.env.SLACK_SIGNING_SECRET || '',
      webhookUrl: process.env.SLACK_WEBHOOK_URL,
    },
    maxFileSize: parseInt(process.env.EXPORT_MAX_FILE_SIZE || '104857600'), // 100MB
    signedUrlTTL: parseInt(process.env.EXPORT_SIGNED_URL_TTL || '3600'), // 1 hour
    retentionDays: parseInt(process.env.EXPORT_RETENTION_DAYS || '90'),
  },
  governance: {
    auditLog: {
      enabled: process.env.AUDIT_LOG_ENABLED !== 'false',
      retention: {
        hipaa: parseInt(process.env.HIPAA_AUDIT_RETENTION || '2555'), // 7 years
        gdpr: parseInt(process.env.GDPR_AUDIT_RETENTION || '365'), // 1 year
        soc2: parseInt(process.env.SOC2_AUDIT_RETENTION || '1825'), // 5 years
      },
      sensitiveFields: (process.env.SENSITIVE_FIELDS || 'email,phone,ssn,address').split(','),
    },
    compliancePresets: {
      hipaa: {
        name: 'HIPAA',
        description: 'Health Insurance Portability and Accountability Act compliance',
        dataRetention: parseInt(process.env.HIPAA_DATA_RETENTION || '2555'), // 7 years
        piiMasking: {
          enabled: true,
          fields: ['name', 'email', 'phone', 'ssn', 'address', 'dob'],
          maskingStrategy: 'full',
        },
        auditRequirements: {
          logAllAccess: true,
          logDataChanges: true,
          logFailedAttempts: true,
        },
        exportRestrictions: {
          enabled: true,
          approvalRequired: true,
          maxRecords: 1000,
        },
      },
      gdpr: {
        name: 'GDPR',
        description: 'General Data Protection Regulation compliance',
        dataRetention: parseInt(process.env.GDPR_DATA_RETENTION || '365'), // 1 year
        piiMasking: {
          enabled: true,
          fields: ['name', 'email', 'phone', 'address'],
          maskingStrategy: 'partial',
        },
        auditRequirements: {
          logAllAccess: true,
          logDataChanges: true,
          logFailedAttempts: true,
        },
        exportRestrictions: {
          enabled: true,
          approvalRequired: false,
          maxRecords: 5000,
        },
      },
      soc2: {
        name: 'SOC2',
        description: 'Service Organization Control 2 compliance',
        dataRetention: parseInt(process.env.SOC2_DATA_RETENTION || '1825'), // 5 years
        piiMasking: {
          enabled: true,
          fields: ['email', 'phone', 'address'],
          maskingStrategy: 'hash',
        },
        auditRequirements: {
          logAllAccess: true,
          logDataChanges: true,
          logFailedAttempts: true,
        },
        exportRestrictions: {
          enabled: true,
          approvalRequired: true,
          maxRecords: 2500,
        },
      },
    },
    rowLevelSecurity: {
      enabled: process.env.ROW_LEVEL_SECURITY !== 'false',
      defaultPolicy: process.env.RLS_DEFAULT_POLICY === 'allow' ? 'allow' : 'deny',
    },
    columnLevelSecurity: {
      enabled: process.env.COLUMN_LEVEL_SECURITY !== 'false',
      piiColumns: (process.env.PII_COLUMNS || 'name,email,phone,ssn,address,dob').split(','),
      restrictedColumns: (process.env.RESTRICTED_COLUMNS || 'salary,performance_score').split(','),
    },
    metricVersioning: {
      enabled: process.env.METRIC_VERSIONING !== 'false',
      retention: parseInt(process.env.METRIC_VERSION_RETENTION || '10'),
    },
  },
};

export default config;
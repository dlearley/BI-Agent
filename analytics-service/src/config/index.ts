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
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || 'analytics-crm-ingestion',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    ssl: process.env.NODE_ENV === 'production',
    sasl: {
      mechanism: process.env.KAFKA_SASL_MECHANISM || 'plain',
      username: process.env.KAFKA_USERNAME,
      password: process.env.KAFKA_PASSWORD,
    },
    schemaRegistry: {
      url: process.env.SCHEMA_REGISTRY_URL || 'http://localhost:8081',
      username: process.env.SCHEMA_REGISTRY_USERNAME,
      password: process.env.SCHEMA_REGISTRY_PASSWORD,
    },
    topics: {
      crmEvents: process.env.CRM_EVENTS_TOPIC || 'crm.events',
      crmLeads: process.env.CRM_LEADS_TOPIC || 'crm.leads',
      crmContacts: process.env.CRM_CONTACTS_TOPIC || 'crm.contacts',
      crmOpportunities: process.env.CRM_OPPORTUNITIES_TOPIC || 'crm.opportunities',
    },
    consumer: {
      groupId: process.env.KAFKA_CONSUMER_GROUP_ID || 'analytics-crm-consumer',
      sessionTimeout: parseInt(process.env.KAFKA_SESSION_TIMEOUT || '30000'),
      heartbeatInterval: parseInt(process.env.KAFKA_HEARTBEAT_INTERVAL || '3000'),
      maxWaitTimeInMs: parseInt(process.env.KAFKA_MAX_WAIT_TIME || '5000'),
    },
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
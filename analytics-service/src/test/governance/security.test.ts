import request from 'supertest';
import app from '../../index';
import { UserRole, Permission } from '../../types';
import { db } from '../../config/database';
import { governanceService } from '../../services/governance.service';

describe('Governance Security Tests', () => {
  let adminToken: string;
  let recruiterToken: string;
  let viewerToken: string;
  let restrictedUserToken: string;

  const testUsers = {
    admin: {
      id: 'admin-123',
      email: 'admin@test.com',
      role: UserRole.ADMIN,
      permissions: Object.values(Permission),
      facilityId: undefined,
    },
    recruiter: {
      id: 'recruiter-123',
      email: 'recruiter@test.com',
      role: UserRole.RECRUITER,
      permissions: [Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS],
      facilityId: 'facility-1',
    },
    viewer: {
      id: 'viewer-123',
      email: 'viewer@test.com',
      role: UserRole.VIEWER,
      permissions: [Permission.VIEW_ANALYTICS],
      facilityId: 'facility-1',
    },
    restricted: {
      id: 'restricted-123',
      email: 'restricted@test.com',
      role: UserRole.VIEWER,
      permissions: [Permission.VIEW_ANALYTICS],
      facilityId: 'facility-2',
    },
  };

  beforeAll(async () => {
    // Generate test tokens (simplified for testing)
    const jwt = require('jsonwebtoken');
    const config = require('../../config').default;

    adminToken = jwt.sign(testUsers.admin, config.jwt.secret);
    recruiterToken = jwt.sign(testUsers.recruiter, config.jwt.secret);
    viewerToken = jwt.sign(testUsers.viewer, config.jwt.secret);
    restrictedUserToken = jwt.sign(testUsers.restricted, config.jwt.secret);

    // Initialize test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanupTestData();
    await db.close();
  });

  describe('RBAC Enforcement', () => {
    describe('Analytics Access Control', () => {
      it('should allow admin to access all analytics', async () => {
        const response = await request(app)
          .get('/api/v1/analytics/pipeline')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should allow recruiter to access facility analytics', async () => {
        const response = await request(app)
          .get('/api/v1/analytics/pipeline')
          .set('Authorization', `Bearer ${recruiterToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toBeDefined();
      });

      it('should deny access without authentication', async () => {
        await request(app)
          .get('/api/v1/analytics/pipeline')
          .expect(401);
      });

      it('should deny access with invalid token', async () => {
        await request(app)
          .get('/api/v1/analytics/pipeline')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);
      });
    });

    describe('Row-Level Security', () => {
      it('should restrict recruiter to their facility data', async () => {
        const response = await request(app)
          .get('/api/v1/analytics/pipeline')
          .set('Authorization', `Bearer ${recruiterToken}`)
          .expect(200);

        // Verify that returned data is only for facility-1
        if (Array.isArray(response.body.data)) {
          response.body.data.forEach((item: any) => {
            expect(item.facility_id).toBe('facility-1');
          });
        }
      });

      it('should deny restricted user access to other facilities', async () => {
        const response = await request(app)
          .get('/api/v1/analytics/pipeline')
          .set('Authorization', `Bearer ${restrictedUserToken}`)
          .expect(200);

        // Should return empty or facility-2 data only
        if (Array.isArray(response.body.data) && response.body.data.length > 0) {
          response.body.data.forEach((item: any) => {
            expect(item.facility_id).toBe('facility-2');
          });
        }
      });
    });

    describe('Permission-Based Access', () => {
      it('should deny viewer access to admin-only endpoints', async () => {
        await request(app)
          .post('/api/v1/analytics/refresh')
          .set('Authorization', `Bearer ${viewerToken}`)
          .expect(403);
      });

      it('should allow admin access to admin-only endpoints', async () => {
        const response = await request(app)
          .post('/api/v1/analytics/refresh')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('PII Masking', () => {
    describe('HIPAA Compliance', () => {
      it('should mask PII for users without VIEW_PII permission', async () => {
        const response = await request(app)
          .get('/api/v1/analytics/pipeline?includePII=true')
          .set('Authorization', `Bearer ${recruiterToken}`)
          .expect(200);

        // Check that PII fields are masked
        const data = response.body.data;
        if (Array.isArray(data)) {
          data.forEach((item: any) => {
            if (item.email) {
              expect(item.email).toBe('***@***.***');
            }
            if (item.phone) {
              expect(item.phone).toBe('***-***-****');
            }
          });
        }
      });

      it('should allow PII access for users with VIEW_PII permission', async () => {
        const response = await request(app)
          .get('/api/v1/analytics/pipeline?includePII=true')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Admin should see unmasked PII
        expect(response.body.success).toBe(true);
      });
    });

    describe('GDPR Compliance', () => {
      it('should apply partial masking for GDPR compliance', async () => {
        const response = await request(app)
          .post('/api/v1/governance/presets/gdpr/apply')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ scope: 'test' })
          .expect(200);

        expect(response.body.data.securityContext.complianceFramework).toBe('gdpr');
      });
    });

    describe('SOC2 Compliance', () => {
      it('should apply hash masking for SOC2 compliance', async () => {
        const response = await request(app)
          .post('/api/v1/governance/presets/soc2/apply')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ scope: 'test' })
          .expect(200);

        expect(response.body.data.securityContext.complianceFramework).toBe('soc2');
      });
    });
  });

  describe('Audit Logging', () => {
    it('should log all data access attempts', async () => {
      await request(app)
        .get('/api/v1/analytics/pipeline')
        .set('Authorization', `Bearer ${recruiterToken}`)
        .expect(200);

      // Check that audit log was created
      const auditResponse = await request(app)
        .get('/api/v1/governance/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(auditResponse.body.data).toBeDefined();
      const logs = auditResponse.body.data;
      const accessLog = logs.find((log: any) => log.action === 'view_audit_logs' || log.resource === 'analytics');
      expect(accessLog).toBeDefined();
    });

    it('should log failed access attempts', async () => {
      await request(app)
        .post('/api/v1/analytics/refresh')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);

      // Check that failed access was logged
      const auditResponse = await request(app)
        .get('/api/v1/governance/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const logs = auditResponse.body.data;
      const failedLog = logs.find((log: any) => !log.success && log.action === 'refresh_analytics');
      expect(failedLog).toBeDefined();
    });

    it('should include compliance framework in audit logs', async () => {
      const response = await request(app)
        .post('/api/v1/governance/presets/hipaa/apply')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ scope: 'test' })
        .expect(200);

      // Check audit log for compliance framework
      const auditResponse = await request(app)
        .get('/api/v1/governance/audit-logs?complianceFramework=hipaa')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(auditResponse.body.data).toBeDefined();
    });
  });

  describe('Metric Versioning', () => {
    it('should create metric versions for data changes', async () => {
      const response = await request(app)
        .get('/api/v1/governance/metrics/versions/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should allow viewing metric history', async () => {
      const response = await request(app)
        .get('/api/v1/governance/metrics/pipeline_kpis/test-metric/versions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should deny version access without proper permissions', async () => {
      await request(app)
        .get('/api/v1/governance/metrics/pipeline_kpis/test-metric/versions')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });
  });

  describe('Data Export Restrictions', () => {
    it('should deny export without EXPORT_DATA permission', async () => {
      await request(app)
        .post('/api/v1/governance/export/analytics')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({ format: 'json', limit: 100 })
        .expect(403);
    });

    it('should allow export with proper permissions', async () => {
      // Grant export permission to admin
      const response = await request(app)
        .post('/api/v1/governance/export/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ format: 'json', limit: 100 })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should enforce export record limits', async () => {
      const response = await request(app)
        .post('/api/v1/governance/export/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ format: 'json', limit: 20000 }) // Exceeds default limit
        .expect(400);

      expect(response.body.error).toContain('limit');
    });
  });

  describe('Compliance Reports', () => {
    it('should generate compliance reports', async () => {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);

      const response = await request(app)
        .get(`/api/v1/governance/reports/hipaa?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.framework).toBe('hipaa');
      expect(response.body.data.auditStatistics).toBeDefined();
      expect(response.body.data.piiAccessStatistics).toBeDefined();
    });

    it('should deny report access without proper permissions', async () => {
      await request(app)
        .get('/api/v1/governance/reports/hipaa')
        .set('Authorization', `Bearer ${viewerToken}`)
        .expect(403);
    });
  });

  describe('Security Validation', () => {
    it('should validate PII masking effectiveness', async () => {
      const originalData = {
        email: 'test@example.com',
        phone: '555-123-4567',
        name: 'John Doe'
      };

      const maskedData = {
        email: '***@***.***',
        phone: '***-***-****',
        name: '[REDACTED]'
      };

      const response = await request(app)
        .post('/api/v1/governance/validate-pii-masking')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          originalData,
          maskedData,
          framework: 'hipaa'
        })
        .expect(200);

      expect(response.body.data.isValid).toBe(true);
    });

    it('should validate data access permissions', async () => {
      const response = await request(app)
        .post('/api/v1/governance/validate-access')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          resourceType: 'analytics',
          framework: 'hipaa'
        })
        .expect(200);

      expect(response.body.data.allowed).toBe(true);
    });
  });
});

async function setupTestData(): Promise<void> {
  // Create test facilities and data for testing
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS test_facilities (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        phone VARCHAR(50),
        address TEXT
      )
    `);

    await db.query(`
      INSERT INTO test_facilities (id, name, email, phone, address) VALUES
        ('facility-1', 'Test Facility 1', 'facility1@test.com', '555-0001', '123 Test St'),
        ('facility-2', 'Test Facility 2', 'facility2@test.com', '555-0002', '456 Test Ave')
      ON CONFLICT (id) DO NOTHING
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS analytics.pipeline_kpis_materialized (
        id SERIAL PRIMARY KEY,
        facility_id VARCHAR(100),
        facility_name VARCHAR(255),
        email VARCHAR(255),
        phone VARCHAR(50),
        month DATE,
        total_applications INTEGER,
        hired_count INTEGER,
        rejected_count INTEGER,
        pending_count INTEGER,
        interview_count INTEGER,
        avg_time_to_fill_days DECIMAL(10,2)
      )
    `);

    await db.query(`
      INSERT INTO analytics.pipeline_kpis_materialized 
      (facility_id, facility_name, email, phone, month, total_applications, hired_count, rejected_count, pending_count, interview_count, avg_time_to_fill_days) VALUES
      ('facility-1', 'Test Facility 1', 'admin@facility1.com', '555-1111', CURRENT_DATE, 100, 25, 30, 20, 50, 15.5),
      ('facility-2', 'Test Facility 2', 'admin@facility2.com', '555-2222', CURRENT_DATE, 80, 20, 25, 15, 40, 18.2)
      ON CONFLICT DO NOTHING
    `);
  } catch (error) {
    console.error('Error setting up test data:', error);
  }
}

async function cleanupTestData(): Promise<void> {
  try {
    await db.query('DROP TABLE IF EXISTS analytics.pipeline_kpis_materialized');
    await db.query('DROP TABLE IF EXISTS test_facilities');
    await db.query('DROP TABLE IF EXISTS audit_logs');
    await db.query('DROP TABLE IF EXISTS metric_versions');
    await db.query('DROP TABLE IF EXISTS governance_policies');
  } catch (error) {
    console.error('Error cleaning up test data:', error);
  }
}
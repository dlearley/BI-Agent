import request from 'supertest';
import app from '../src/index';
import { ExportType, ExportFormat } from '../src/types';

describe('Export API', () => {
  let authToken: string;

  beforeAll(async () => {
    // Get auth token (you'll need to implement proper auth in your test setup)
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('POST /api/v1/exports/schedules', () => {
    it('should create a new export schedule', async () => {
      const scheduleData = {
        name: 'Weekly KPI Report',
        description: 'Weekly KPI analytics report',
        exportType: ExportType.KPI,
        format: ExportFormat.CSV,
        scheduleExpression: '0 9 * * 1', // Every Monday at 9 AM
        filters: {
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        },
        templateData: {
          subject: 'Weekly KPI Report',
          body: 'Please find attached the weekly KPI report.',
          includeAttachment: true,
          attachmentName: 'kpi_report.csv'
        },
        recipients: [
          {
            recipientType: 'email',
            recipientAddress: 'manager@example.com'
          }
        ]
      };

      const response = await request(app)
        .post('/api/v1/exports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(scheduleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(scheduleData.name);
      expect(response.body.data.exportType).toBe(scheduleData.exportType);
      expect(response.body.data.format).toBe(scheduleData.format);
    });

    it('should return 400 for missing required fields', async () => {
      const invalidData = {
        name: 'Invalid Schedule'
        // Missing exportType, format, scheduleExpression
      };

      const response = await request(app)
        .post('/api/v1/exports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.error).toBe('Missing required fields');
    });
  });

  describe('GET /api/v1/exports/schedules', () => {
    it('should get all export schedules', async () => {
      const response = await request(app)
        .get('/api/v1/exports/schedules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/exports/jobs', () => {
    it('should create a new export job', async () => {
      const jobData = {
        exportType: ExportType.DASHBOARD,
        format: ExportFormat.PDF,
        filters: {
          startDate: '2023-01-01',
          endDate: '2023-12-31'
        }
      };

      const response = await request(app)
        .post('/api/v1/exports/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(jobData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.exportType).toBe(jobData.exportType);
      expect(response.body.data.format).toBe(jobData.format);
      expect(response.body.data.status).toBe('processing');
    });

    it('should return 400 for invalid export type', async () => {
      const invalidJobData = {
        exportType: 'invalid_type',
        format: ExportFormat.CSV
      };

      const response = await request(app)
        .post('/api/v1/exports/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidJobData)
        .expect(400);

      expect(response.body.error).toBe('Invalid export type');
    });
  });

  describe('GET /api/v1/exports/jobs', () => {
    it('should get all export jobs', async () => {
      const response = await request(app)
        .get('/api/v1/exports/jobs')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/exports/queue/stats', () => {
    it('should get export queue statistics (admin only)', async () => {
      const response = await request(app)
        .get('/api/v1/exports/queue/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403); // Should fail for non-admin users
    });
  });
});
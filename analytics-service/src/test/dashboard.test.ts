import request from 'supertest';
import app from '../index';
import { DashboardType } from '../types';

describe('Dashboard API', () => {
  describe('GET /api/v1/dashboard', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard')
        .query({
          dashboardType: DashboardType.COMBINED,
        });

      expect(response.status).toBe(401);
    });

    it('should return 400 with invalid dashboard type', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', 'Bearer test-token')
        .query({
          dashboardType: 'invalid-type',
        });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/v1/dashboard/pipeline', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/pipeline');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/dashboard/revenue', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/revenue');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/dashboard/compliance', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/compliance');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/dashboard/outreach', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/outreach');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/dashboard/combined', () => {
    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/combined');

      expect(response.status).toBe(401);
    });
  });

  describe('Saved Views', () => {
    describe('POST /api/v1/dashboard/views', () => {
      it('should return 401 without authentication', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/views')
          .send({
            name: 'Test View',
            dashboardType: DashboardType.COMBINED,
          });

        expect(response.status).toBe(401);
      });
    });

    describe('GET /api/v1/dashboard/views', () => {
      it('should return 401 without authentication', async () => {
        const response = await request(app)
          .get('/api/v1/dashboard/views');

        expect(response.status).toBe(401);
      });
    });
  });

  describe('Export endpoints', () => {
    describe('POST /api/v1/dashboard/export', () => {
      it('should return 401 without authentication', async () => {
        const response = await request(app)
          .post('/api/v1/dashboard/export')
          .send({
            dashboardType: DashboardType.COMBINED,
          });

        expect(response.status).toBe(401);
      });
    });
  });
});
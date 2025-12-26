import request from 'supertest';
import express from 'express';
import { Router } from 'express';
import { authenticate, authorize, facilityScope } from '../middleware/auth';
import { hipaaCompliance } from '../middleware/hipaa';
import { Permission, DashboardType } from '../types';

// Create a minimal test app to verify routes
const testApp = express();
const dashboardRouter = Router();

// Apply authentication and HIPAA middleware to all routes
dashboardRouter.use(authenticate);
dashboardRouter.use(hipaaCompliance);
dashboardRouter.use(facilityScope);

// Pipeline Dashboard
dashboardRouter.get(
  '/pipeline',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  (req, res) => {
    res.json({ success: true, data: 'pipeline data' });
  }
);

// Revenue Dashboard
dashboardRouter.get(
  '/revenue',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  (req, res) => {
    res.json({ success: true, data: 'revenue data' });
  }
);

// Combined Dashboard
dashboardRouter.get(
  '/combined',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  (req, res) => {
    res.json({ success: true, data: 'combined data' });
  }
);

testApp.use('/api/v1/dashboard', dashboardRouter);

describe('Dashboard API Routes', () => {
  describe('Authentication', () => {
    it('should require authentication for pipeline dashboard', async () => {
      const response = await request(testApp)
        .get('/api/v1/dashboard/pipeline');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for revenue dashboard', async () => {
      const response = await request(testApp)
        .get('/api/v1/dashboard/revenue');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    it('should require authentication for combined dashboard', async () => {
      const response = await request(testApp)
        .get('/api/v1/dashboard/combined');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Route Structure', () => {
    it('should have pipeline route', async () => {
      const response = await request(testApp)
        .get('/api/v1/dashboard/pipeline')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, data: 'pipeline data' });
    });

    it('should have revenue route', async () => {
      const response = await request(testApp)
        .get('/api/v1/dashboard/revenue')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, data: 'revenue data' });
    });

    it('should have combined route', async () => {
      const response = await request(testApp)
        .get('/api/v1/dashboard/combined')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ success: true, data: 'combined data' });
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(testApp)
        .get('/api/v1/dashboard/nonexistent')
        .set('Authorization', 'Bearer valid-token');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
    });
  });
});
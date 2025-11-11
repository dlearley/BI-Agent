import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { analyticsController } from '../../controllers/analytics.controller';
import { mockAdminUser, mockRecruiterUser, mockPipelineKPIs } from '../setup';

// Mock middleware and services
jest.mock('../../middleware/auth');
jest.mock('../../middleware/hipaa');
jest.mock('../../services/analytics.service');
jest.mock('../../services/queue.service');

describe('Analytics Controller', () => {
  let app: express.Application;

  beforeEach(() => {
    jest.clearAllMocks();
    
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    const mockAuth = require('../../middleware/auth');
    mockAuth.authenticate.mockImplementation((req, res, next) => {
      req.user = mockAdminUser; // Default to admin user
      next();
    });
    
    mockAuth.authorize.mockImplementation(() => (req, res, next) => next());
    mockAuth.facilityScope.mockImplementation((req, res, next) => next());
    
    // Mock HIPAA middleware
    const mockHipaa = require('../../middleware/hipaa');
    mockHipaa.hipaaCompliance.mockImplementation((req, res, next) => next());
    
    // Setup routes
    app.get('/analytics/pipeline', analyticsController.getPipelineKPIs.bind(analyticsController));
    app.get('/analytics/compliance', analyticsController.getComplianceMetrics.bind(analyticsController));
    app.get('/analytics/revenue', analyticsController.getRevenueMetrics.bind(analyticsController));
    app.get('/analytics/outreach', analyticsController.getOutreachMetrics.bind(analyticsController));
    app.get('/analytics/kpis', analyticsController.getCombinedKPIs.bind(analyticsController));
    app.post('/analytics/refresh', analyticsController.refreshAnalytics.bind(analyticsController));
    app.get('/analytics/health', analyticsController.getAnalyticsHealth.bind(analyticsController));
  });

  describe('GET /analytics/pipeline', () => {
    it('should return pipeline KPIs successfully', async () => {
      // Arrange
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getPipelineKPIs.mockResolvedValue(mockPipelineKPIs);

      // Act
      const response = await request(app).get('/analytics/pipeline');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: mockPipelineKPIs,
        cached: false,
        timestamp: expect.any(String),
      });
      expect(mockAnalyticsService.analyticsService.getPipelineKPIs).toHaveBeenCalledWith({}, mockAdminUser);
    });

    it('should handle query parameters', async () => {
      // Arrange
      const query = { startDate: '2023-01-01', endDate: '2023-12-31' };
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getPipelineKPIs.mockResolvedValue(mockPipelineKPIs);

      // Act
      const response = await request(app).get('/analytics/pipeline').query(query);

      // Assert
      expect(response.status).toBe(200);
      expect(mockAnalyticsService.analyticsService.getPipelineKPIs).toHaveBeenCalledWith(query, mockAdminUser);
    });

    it('should handle service errors', async () => {
      // Arrange
      const error = new Error('Database error');
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getPipelineKPIs.mockRejectedValue(error);

      // Act
      const response = await request(app).get('/analytics/pipeline');

      // Assert
      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        success: false,
        error: 'Failed to fetch pipeline KPIs',
        message: 'Database error',
      });
    });
  });

  describe('GET /analytics/compliance', () => {
    it('should return compliance metrics successfully', async () => {
      // Arrange
      const mockComplianceMetrics = [
        {
          totalApplications: 100,
          compliantApplications: 85,
          complianceRate: 85.0,
          violations: [],
        },
      ];
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getComplianceMetrics.mockResolvedValue(mockComplianceMetrics);

      // Act
      const response = await request(app).get('/analytics/compliance');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockComplianceMetrics);
    });
  });

  describe('GET /analytics/revenue', () => {
    it('should return revenue metrics successfully', async () => {
      // Arrange
      const mockRevenueMetrics = {
        totalRevenue: 250000,
        averageRevenuePerPlacement: 5000,
        revenueByFacility: [],
        revenueByMonth: [],
      };
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getRevenueMetrics.mockResolvedValue(mockRevenueMetrics);

      // Act
      const response = await request(app).get('/analytics/revenue');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockRevenueMetrics);
    });
  });

  describe('GET /analytics/outreach', () => {
    it('should return outreach metrics successfully', async () => {
      // Arrange
      const mockOutreachMetrics = {
        totalOutreach: 500,
        responseRate: 30.0,
        conversionRate: 5.0,
        effectiveChannels: [],
      };
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getOutreachMetrics.mockResolvedValue(mockOutreachMetrics);

      // Act
      const response = await request(app).get('/analytics/outreach');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockOutreachMetrics);
    });
  });

  describe('GET /analytics/kpis', () => {
    it('should return combined KPIs successfully', async () => {
      // Arrange
      const mockCombinedKPIs = [
        {
          pipelineCount: 100,
          timeToFill: 15.5,
          complianceStatus: {
            totalApplications: 100,
            compliantApplications: 85,
            complianceRate: 85.0,
            violations: [],
          },
          revenue: {
            totalRevenue: 250000,
            averageRevenuePerPlacement: 5000,
            revenueByFacility: [],
            revenueByMonth: [],
          },
          outreachEffectiveness: {
            totalOutreach: 500,
            responseRate: 30.0,
            conversionRate: 5.0,
            effectiveChannels: [],
          },
        },
      ];
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getCombinedKPIs.mockResolvedValue(mockCombinedKPIs);

      // Act
      const response = await request(app).get('/analytics/kpis');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toEqual(mockCombinedKPIs);
    });
  });

  describe('POST /analytics/refresh', () => {
    it('should enqueue refresh job for admin user', async () => {
      // Arrange
      const mockJob = { id: 'job-123', opts: { delay: 0 } };
      const mockQueueService = require('../../services/queue.service');
      mockQueueService.queueService.enqueueRefreshJob.mockResolvedValue(mockJob);

      // Act
      const response = await request(app).post('/analytics/refresh').send({
        viewName: 'pipeline',
      });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        message: 'Analytics refresh job enqueued successfully',
        data: {
          jobId: 'job-123',
          viewName: 'pipeline',
          estimatedDelay: 0,
        },
      });
      expect(mockQueueService.queueService.enqueueRefreshJob).toHaveBeenCalledWith('pipeline');
    });

    it('should handle refresh without specific view', async () => {
      // Arrange
      const mockJob = { id: 'job-456', opts: { delay: 0 } };
      const mockQueueService = require('../../services/queue.service');
      mockQueueService.queueService.enqueueRefreshJob.mockResolvedValue(mockJob);

      // Act
      const response = await request(app).post('/analytics/refresh');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data.viewName).toBe('all');
      expect(mockQueueService.queueService.enqueueRefreshJob).toHaveBeenCalledWith(undefined);
    });
  });

  describe('GET /analytics/health', () => {
    it('should return analytics health status', async () => {
      // Arrange
      const mockLastRefresh = [
        { view_name: 'pipeline_kpis', last_updated: new Date() },
        { view_name: 'compliance_kpis', last_updated: new Date() },
      ];
      const mockAnalyticsService = require('../../services/analytics.service');
      mockAnalyticsService.analyticsService.getLastRefreshTimes.mockResolvedValue(mockLastRefresh);
      
      const mockQueueService = require('../../services/queue.service');
      mockQueueService.queueService.getQueueStats.mockResolvedValue({
        waiting: 0,
        active: 0,
        completed: 50,
        failed: 0,
        paused: false,
      });

      // Act
      const response = await request(app).get('/analytics/health');

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        database: 'healthy',
        redis: 'healthy',
        lastRefresh: mockLastRefresh,
        queueStats: expect.any(Object),
        timestamp: expect.any(String),
      });
    });
  });
});
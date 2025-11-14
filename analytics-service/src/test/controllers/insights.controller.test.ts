import { Request, Response } from 'express';
import { insightsController } from '../../controllers/insights.controller';
import { insightsService } from '../../services/insights.service';
import { mlService } from '../../services/ml.service';
import { AuthenticatedRequest } from '../../middleware/auth';
import { User, UserRole, Permission } from '../../types';

jest.mock('../../services/insights.service');
jest.mock('../../services/ml.service');

describe('InsightsController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockUser: User;

  beforeEach(() => {
    mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      role: UserRole.ADMIN,
      permissions: [Permission.VIEW_ANALYTICS],
    };

    mockRequest = {
      user: mockUser,
      query: {},
      body: {},
      params: {},
    };

    mockResponse = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };

    jest.clearAllMocks();
  });

  describe('getInsights', () => {
    it('should return insights report successfully', async () => {
      const mockReport = {
        id: 'insight_123',
        timestamp: '2024-01-01T00:00:00Z',
        query: {},
        anomalies: {
          detected: [],
          statistics: { mean: 100, stdDev: 10, threshold: 3, method: 'zscore' },
          totalPoints: 30,
          anomalyRate: 0,
        },
        drivers: {
          topDrivers: [],
          metadata: { method: 'importance', totalFeatures: 0, samplesAnalyzed: 0 },
        },
        trends: {
          direction: 'stable' as const,
          strength: 0,
          variance: 0,
          changeRate: 0,
        },
        narrative: 'Test narrative',
      };

      (insightsService.generateInsights as jest.Mock).mockResolvedValue(mockReport);

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      await insightsController.getInsights(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport,
        timestamp: expect.any(String),
      });
    });

    it('should handle query parameters', async () => {
      const mockReport = {
        id: 'insight_123',
        timestamp: '2024-01-01T00:00:00Z',
        query: { startDate: '2024-01-01', endDate: '2024-01-31', facilityId: 'facility-1' },
        anomalies: {
          detected: [],
          statistics: { mean: 100, stdDev: 10, threshold: 3, method: 'zscore' },
          totalPoints: 0,
          anomalyRate: 0,
        },
        drivers: {
          topDrivers: [],
          metadata: { method: 'importance', totalFeatures: 0, samplesAnalyzed: 0 },
        },
        trends: {
          direction: 'stable' as const,
          strength: 0,
          variance: 0,
          changeRate: 0,
        },
        narrative: 'Test narrative',
      };

      (insightsService.generateInsights as jest.Mock).mockResolvedValue(mockReport);

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        facilityId: 'facility-1',
      };

      await insightsController.getInsights(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(insightsService.generateInsights).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          facilityId: 'facility-1',
        }),
        mockUser
      );
    });

    it('should handle errors gracefully', async () => {
      (insightsService.generateInsights as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await insightsController.getInsights(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to generate insights',
        message: 'Database error',
      });
    });
  });

  describe('getReport', () => {
    it('should return existing report', async () => {
      const mockReport = {
        id: 'insight_123',
        timestamp: '2024-01-01T00:00:00Z',
        query: {},
        anomalies: {
          detected: [],
          statistics: { mean: 100, stdDev: 10, threshold: 3, method: 'zscore' },
          totalPoints: 0,
          anomalyRate: 0,
        },
        drivers: {
          topDrivers: [],
          metadata: { method: 'importance', totalFeatures: 0, samplesAnalyzed: 0 },
        },
        trends: {
          direction: 'stable' as const,
          strength: 0,
          variance: 0,
          changeRate: 0,
        },
        narrative: 'Test narrative',
      };

      (insightsService.getReport as jest.Mock).mockResolvedValue(mockReport);

      mockRequest.params = { reportId: 'insight_123' };

      await insightsController.getReport(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockReport,
        timestamp: expect.any(String),
      });
    });

    it('should return 404 for non-existent report', async () => {
      (insightsService.getReport as jest.Mock).mockResolvedValue(null);

      mockRequest.params = { reportId: 'nonexistent' };

      await insightsController.getReport(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Report not found',
      });
    });

    it('should handle errors gracefully', async () => {
      (insightsService.getReport as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      mockRequest.params = { reportId: 'insight_123' };

      await insightsController.getReport(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to fetch report',
        message: 'Database error',
      });
    });
  });

  describe('detectAnomalies', () => {
    it('should detect anomalies from provided data', async () => {
      const mockData = [
        { timestamp: '2024-01-01', value: 100 },
        { timestamp: '2024-01-02', value: 105 },
        { timestamp: '2024-01-03', value: 300 },
      ];

      const mockResult = {
        anomalies: [
          {
            timestamp: '2024-01-03',
            value: 300,
            expectedValue: 102.5,
            score: 4.5,
            severity: 'high' as const,
          },
        ],
        statistics: {
          mean: 168.33,
          stdDev: 94.28,
          threshold: 3,
          method: 'zscore',
        },
      };

      (mlService.detectAnomalies as jest.Mock).mockReturnValue(mockResult);

      mockRequest.body = {
        data: mockData,
        method: 'zscore',
        threshold: 3,
      };

      await insightsController.detectAnomalies(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mlService.detectAnomalies).toHaveBeenCalledWith(
        mockData,
        expect.objectContaining({
          method: 'zscore',
          threshold: 3,
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        timestamp: expect.any(String),
      });
    });

    it('should use default parameters when not provided', async () => {
      const mockData = [
        { timestamp: '2024-01-01', value: 100 },
      ];

      const mockResult = {
        anomalies: [],
        statistics: {
          mean: 100,
          stdDev: 0,
          threshold: 3,
          method: 'esd',
        },
      };

      (mlService.detectAnomalies as jest.Mock).mockReturnValue(mockResult);

      mockRequest.body = { data: mockData };

      await insightsController.detectAnomalies(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mlService.detectAnomalies).toHaveBeenCalledWith(
        mockData,
        expect.objectContaining({
          method: undefined,
          threshold: undefined,
        })
      );
    });

    it('should handle invalid input data', async () => {
      mockRequest.body = {
        data: 'invalid',
      };

      await insightsController.detectAnomalies(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to detect anomalies',
        })
      );
    });
  });

  describe('analyzeDrivers', () => {
    it('should analyze feature drivers', async () => {
      const mockFeatures = {
        feature1: [1, 2, 3, 4, 5],
        feature2: [2, 4, 6, 8, 10],
      };
      const mockTarget = [10, 20, 30, 40, 50];

      const mockResult = {
        drivers: [
          {
            feature: 'feature2',
            importance: 0.95,
            contribution: 1.8,
            direction: 'positive' as const,
          },
          {
            feature: 'feature1',
            importance: 0.85,
            contribution: 0.9,
            direction: 'positive' as const,
          },
        ],
        metadata: {
          method: 'importance',
          totalFeatures: 2,
          samplesAnalyzed: 5,
        },
      };

      (mlService.analyzeDrivers as jest.Mock).mockReturnValue(mockResult);

      mockRequest.body = {
        features: mockFeatures,
        target: mockTarget,
        method: 'importance',
        topN: 5,
      };

      await insightsController.analyzeDrivers(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mlService.analyzeDrivers).toHaveBeenCalledWith(
        mockFeatures,
        mockTarget,
        expect.objectContaining({
          method: 'importance',
          topN: 5,
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
        timestamp: expect.any(String),
      });
    });

    it('should use correlation method when specified', async () => {
      const mockFeatures = {
        feature1: [1, 2, 3],
      };
      const mockTarget = [10, 20, 30];

      const mockResult = {
        drivers: [
          {
            feature: 'feature1',
            importance: 1.0,
            contribution: 1.0,
            direction: 'positive' as const,
          },
        ],
        metadata: {
          method: 'correlation',
          totalFeatures: 1,
          samplesAnalyzed: 3,
        },
      };

      (mlService.analyzeDrivers as jest.Mock).mockReturnValue(mockResult);

      mockRequest.body = {
        features: mockFeatures,
        target: mockTarget,
        method: 'correlation',
      };

      await insightsController.analyzeDrivers(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mlService.analyzeDrivers).toHaveBeenCalledWith(
        mockFeatures,
        mockTarget,
        expect.objectContaining({
          method: 'correlation',
        })
      );
    });

    it('should handle invalid input data', async () => {
      mockRequest.body = {
        features: 'invalid',
        target: [1, 2, 3],
      };

      await insightsController.analyzeDrivers(
        mockRequest as AuthenticatedRequest,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Failed to analyze drivers',
        })
      );
    });
  });
});

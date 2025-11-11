import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { analyticsService } from '../../services/analytics.service';
import { mockAdminUser, mockRecruiterUser, mockPipelineKPIs } from '../setup';

// Mock modules
jest.mock('../../config/database');
jest.mock('../../config/redis');

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Redis methods
    const mockRedis = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue(),
      getClient: jest.fn().mockReturnValue({
        keys: jest.fn().mockResolvedValue([]),
        del: jest.fn().mockResolvedValue(0),
      }),
    } as any;
    
    // Mock database
    const mockDb = {
      query: jest.fn().mockResolvedValue([]),
      queryOne: jest.fn().mockResolvedValue(null),
    } as any;
    
    // Replace the actual modules with mocks
    jest.doMock('../../config/redis', () => mockRedis);
    jest.doMock('../../config/database', () => mockDb);
  });

  describe('getPipelineKPIs', () => {
    it('should return pipeline KPIs for admin user', async () => {
      // Arrange
      const query = { startDate: '2023-01-01', endDate: '2023-12-31' };
      const mockDb = require('../../config/database').db;
      mockDb.query.mockResolvedValue(mockPipelineKPIs);

      // Act
      const result = await analyticsService.getPipelineKPIs(query, mockAdminUser);

      // Assert
      expect(result).toEqual(mockPipelineKPIs);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('analytics.pipeline_kpis_materialized'),
        expect.arrayContaining(['2023-01-01', '2023-12-31'])
      );
    });

    it('should filter by facility for recruiter user', async () => {
      // Arrange
      const query = { startDate: '2023-01-01', endDate: '2023-12-31' };
      const facilityFilteredKPIs = [mockPipelineKPIs[0]];
      const mockDb = require('../../config/database').db;
      mockDb.query.mockResolvedValue(facilityFilteredKPIs);

      // Act
      const result = await analyticsService.getPipelineKPIs(query, mockRecruiterUser);

      // Assert
      expect(result).toEqual(facilityFilteredKPIs);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('analytics.pipeline_kpis_materialized'),
        expect.arrayContaining(['2023-01-01', '2023-12-31', 'facility-1'])
      );
    });

    it('should return cached results when available', async () => {
      // Arrange
      const query = { startDate: '2023-01-01' };
      const cachedResult = [mockPipelineKPIs[0]];
      const mockRedis = require('../../config/redis').redis;
      mockRedis.get.mockResolvedValue(cachedResult);

      // Act
      const result = await analyticsService.getPipelineKPIs(query, mockAdminUser);

      // Assert
      expect(result).toEqual(cachedResult);
      expect(mockRedis.get).toHaveBeenCalled();
    });
  });

  describe('refreshMaterializedViews', () => {
    it('should refresh all views when no specific view provided', async () => {
      // Arrange
      const mockDb = require('../../config/database').db;
      mockDb.query.mockResolvedValue([]);
      const mockRedis = require('../../config/redis').redis;

      // Act
      await analyticsService.refreshMaterializedViews();

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith('SELECT analytics.refresh_all_analytics()');
      expect(mockRedis.getClient().keys).toHaveBeenCalled();
    });

    it('should refresh specific view when provided', async () => {
      // Arrange
      const mockDb = require('../../config/database').db;
      mockDb.query.mockResolvedValue([]);

      // Act
      await analyticsService.refreshMaterializedViews('pipeline');

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith('SELECT analytics.refresh_pipeline_kpis()');
    });

    it('should throw error for unknown view', async () => {
      // Act & Assert
      await expect(analyticsService.refreshMaterializedViews('unknown'))
        .rejects.toThrow('Unknown view: unknown');
    });
  });
});
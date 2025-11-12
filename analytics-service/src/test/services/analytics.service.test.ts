import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { analyticsService } from '../../services/analytics.service';
import { mockAdminUser, mockRecruiterUser, mockPipelineKPIs } from '../setup';

type RedisInnerClientMock = {
  keys: jest.MockedFunction<(pattern: string) => Promise<string[]>>;
  del: jest.MockedFunction<(...keys: string[]) => Promise<number>>;
};

type RedisClientMock = {
  get: jest.MockedFunction<(key: string) => Promise<unknown>>;
  set: jest.MockedFunction<(key: string, value: unknown, ttl?: number) => Promise<void>>;
  del: jest.MockedFunction<(key: string) => Promise<void>>;
  exists: jest.MockedFunction<(key: string) => Promise<boolean>>;
  flush: jest.MockedFunction<() => Promise<void>>;
  getClient: jest.MockedFunction<() => RedisInnerClientMock>;
  healthCheck: jest.MockedFunction<() => Promise<boolean>>;
  close: jest.MockedFunction<() => Promise<void>>;
};

type DatabaseMock = {
  query: jest.MockedFunction<(text: string, params?: any[]) => Promise<any[]>>;
  queryOne: jest.MockedFunction<(text: string, params?: any[]) => Promise<any | null>>;
  getClient: jest.MockedFunction<() => unknown>;
  transaction: jest.MockedFunction<(callback: any) => Promise<unknown>>;
  close: jest.MockedFunction<() => Promise<void>>;
  healthCheck: jest.MockedFunction<() => Promise<boolean>>;
};

const mockRedisClient: RedisInnerClientMock = {
  keys: jest.fn() as jest.MockedFunction<(pattern: string) => Promise<string[]>>,
  del: jest.fn() as jest.MockedFunction<(...keys: string[]) => Promise<number>>,
};

const mockRedis: RedisClientMock = {
  get: jest.fn() as jest.MockedFunction<(key: string) => Promise<unknown>>,
  set: jest.fn() as jest.MockedFunction<(key: string, value: unknown, ttl?: number) => Promise<void>>,
  del: jest.fn() as jest.MockedFunction<(key: string) => Promise<void>>,
  exists: jest.fn() as jest.MockedFunction<(key: string) => Promise<boolean>>,
  flush: jest.fn() as jest.MockedFunction<() => Promise<void>>,
  getClient: jest.fn() as jest.MockedFunction<() => RedisInnerClientMock>,
  healthCheck: jest.fn() as jest.MockedFunction<() => Promise<boolean>>,
  close: jest.fn() as jest.MockedFunction<() => Promise<void>>,
};

const mockDb: DatabaseMock = {
  query: jest.fn() as jest.MockedFunction<(text: string, params?: any[]) => Promise<any[]>>,
  queryOne: jest.fn() as jest.MockedFunction<(text: string, params?: any[]) => Promise<any | null>>,
  getClient: jest.fn() as jest.MockedFunction<() => unknown>,
  transaction: jest.fn() as jest.MockedFunction<(callback: any) => Promise<unknown>>,
  close: jest.fn() as jest.MockedFunction<() => Promise<void>>,
  healthCheck: jest.fn() as jest.MockedFunction<() => Promise<boolean>>,
};

jest.mock('../../config/redis', () => ({
  __esModule: true,
  get redis() {
    return mockRedis;
  },
  get default() {
    return mockRedis;
  },
}));

jest.mock('../../config/database', () => ({
  __esModule: true,
  get db() {
    return mockDb;
  },
  get default() {
    return mockDb;
  },
}));

describe('AnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockRedis.getClient.mockReturnValue(mockRedisClient);
    mockRedis.get.mockResolvedValue(null);
    mockRedis.set.mockResolvedValue(undefined);
    mockRedis.exists.mockResolvedValue(false);
    mockRedis.flush.mockResolvedValue(undefined);
    mockRedis.del.mockResolvedValue(undefined);
    mockRedis.healthCheck.mockResolvedValue(true);
    mockRedis.close.mockResolvedValue(undefined);

    mockRedisClient.keys.mockResolvedValue([]);
    mockRedisClient.del.mockResolvedValue(0);

    mockDb.query.mockResolvedValue([]);
    mockDb.queryOne.mockResolvedValue(null);
  });

  describe('getPipelineKPIs', () => {
    it('should return pipeline KPIs for admin user', async () => {
      // Arrange
      const query = { startDate: '2023-01-01', endDate: '2023-12-31' };
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
      mockDb.query.mockResolvedValue([]);

      // Act
      await analyticsService.refreshMaterializedViews();

      // Assert
      expect(mockDb.query).toHaveBeenCalledWith('SELECT analytics.refresh_all_analytics()');
      expect(mockRedis.getClient).toHaveBeenCalled();
      expect(mockRedisClient.keys).toHaveBeenCalledWith('analytics:*');
    });

    it('should refresh specific view when provided', async () => {
      // Arrange
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
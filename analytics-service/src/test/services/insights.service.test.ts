import { insightsService } from '../../services/insights.service';
import { db } from '../../config/database';
import { User, UserRole, Permission, AnalyticsQuery } from '../../types';

jest.mock('../../config/database');

describe('InsightsService', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    role: UserRole.ADMIN,
    permissions: [Permission.VIEW_ANALYTICS],
  };

  const mockQuery: AnalyticsQuery = {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generateInsights', () => {
    it('should generate complete insights report', async () => {
      const mockTimeSeriesData = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(100 + Math.sin(i * 0.5) * 10 + (i === 15 ? 100 : 0)),
      }));

      const mockMetricsData = Array.from({ length: 30 }, (_, i) => ({
        total_applications: String(100 + i),
        active_applications: String(50 + i),
        avg_time_to_fill: String(14 + Math.random() * 3),
        placement_rate: String(0.8 + Math.random() * 0.1),
        response_rate: String(0.6 + Math.random() * 0.2),
      }));

      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockTimeSeriesData)
        .mockResolvedValueOnce(mockMetricsData)
        .mockResolvedValueOnce(mockTimeSeriesData)
        .mockResolvedValueOnce([]);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result).toBeDefined();
      expect(result.id).toMatch(/^insight_/);
      expect(result.timestamp).toBeDefined();
      expect(result.anomalies).toBeDefined();
      expect(result.drivers).toBeDefined();
      expect(result.trends).toBeDefined();
      expect(result.narrative).toBeDefined();
      expect(typeof result.narrative).toBe('string');
      expect(result.narrative.length).toBeGreaterThan(0);
    });

    it('should include anomaly detection results', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(i === 10 ? 500 : 100),
      }));

      (db.query as jest.Mock).mockResolvedValue(mockData);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.anomalies).toBeDefined();
      expect(result.anomalies.totalPoints).toBeGreaterThan(0);
      expect(result.anomalies.statistics).toBeDefined();
      expect(result.anomalies.anomalyRate).toBeGreaterThanOrEqual(0);
      expect(result.anomalies.anomalyRate).toBeLessThanOrEqual(1);
    });

    it('should include driver analysis results', async () => {
      const mockTimeSeriesData = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(100 + i),
      }));

      const mockMetricsData = Array.from({ length: 30 }, (_, i) => ({
        total_applications: String(100 + i * 2),
        active_applications: String(50 + i),
        avg_time_to_fill: String(14),
        placement_rate: String(0.8),
        response_rate: String(0.6),
      }));

      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockTimeSeriesData)
        .mockResolvedValueOnce(mockMetricsData)
        .mockResolvedValueOnce(mockTimeSeriesData)
        .mockResolvedValueOnce([]);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.drivers).toBeDefined();
      expect(result.drivers.topDrivers).toBeDefined();
      expect(result.drivers.metadata).toBeDefined();
      expect(result.drivers.metadata.totalFeatures).toBeGreaterThanOrEqual(0);
      expect(result.drivers.metadata.samplesAnalyzed).toBeGreaterThanOrEqual(0);
    });

    it('should include trend analysis', async () => {
      const mockData = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(100 + i * 2),
      }));

      (db.query as jest.Mock).mockResolvedValue(mockData);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.trends).toBeDefined();
      expect(result.trends.direction).toMatch(/increasing|decreasing|stable/);
      expect(result.trends.strength).toBeGreaterThanOrEqual(0);
      expect(result.trends.variance).toBeGreaterThanOrEqual(0);
      expect(typeof result.trends.changeRate).toBe('number');
    });

    it('should generate narrative text', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(100 + i),
      }));

      const mockMetricsData = Array.from({ length: 20 }, (_, i) => ({
        total_applications: String(100 + i),
        active_applications: String(50 + i),
        avg_time_to_fill: String(14),
        placement_rate: String(0.8),
        response_rate: String(0.6),
      }));

      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockData)
        .mockResolvedValueOnce(mockMetricsData)
        .mockResolvedValueOnce(mockData)
        .mockResolvedValueOnce([]);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.narrative).toBeDefined();
      expect(typeof result.narrative).toBe('string');
      expect(result.narrative.length).toBeGreaterThan(50);
      expect(result.narrative).toMatch(/trend|anomal|driver|metric/i);
    });

    it('should handle facility scoping', async () => {
      const facilityUser: User = {
        ...mockUser,
        facilityId: 'facility-123',
      };

      const mockData = Array.from({ length: 10 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(100),
      }));

      (db.query as jest.Mock).mockResolvedValue(mockData);

      await insightsService.generateInsights(mockQuery, facilityUser);

      expect(db.query).toHaveBeenCalled();
      const queryCall = (db.query as jest.Mock).mock.calls[0][0];
      expect(queryCall).toContain('facility-123');
    });

    it('should handle empty data gracefully', async () => {
      (db.query as jest.Mock).mockResolvedValue([]);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result).toBeDefined();
      expect(result.anomalies.totalPoints).toBe(0);
      expect(result.drivers.topDrivers).toHaveLength(0);
      expect(result.narrative).toBeDefined();
    });
  });

  describe('getReport', () => {
    it('should retrieve saved report', async () => {
      const mockReport = {
        id: 'insight_123',
        timestamp: '2024-01-01T00:00:00Z',
        query_params: JSON.stringify(mockQuery),
        anomalies: JSON.stringify({ detected: [], statistics: {}, totalPoints: 0, anomalyRate: 0 }),
        drivers: JSON.stringify({ topDrivers: [], metadata: {} }),
        trends: JSON.stringify({ direction: 'stable', strength: 0, variance: 0, changeRate: 0 }),
        narrative: 'Test narrative',
      };

      (db.query as jest.Mock).mockResolvedValue([mockReport]);

      const result = await insightsService.getReport('insight_123');

      expect(result).toBeDefined();
      expect(result?.id).toBe('insight_123');
      expect(result?.narrative).toBe('Test narrative');
    });

    it('should return null for non-existent report', async () => {
      (db.query as jest.Mock).mockResolvedValue([]);

      const result = await insightsService.getReport('nonexistent');

      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      (db.query as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await insightsService.getReport('insight_123');

      expect(result).toBeNull();
    });
  });

  describe('Narrative generation', () => {
    it('should describe increasing trends correctly', async () => {
      const mockData = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(10 + i * 10),
      }));

      (db.query as jest.Mock).mockResolvedValue(mockData);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.trends.direction).toBe('increasing');
      expect(result.narrative).toMatch(/upward|stable/);
      expect(result.trends.changeRate).toBeGreaterThan(0.05);
    });

    it('should describe decreasing trends correctly', async () => {
      const mockData = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(300 - i * 10),
      }));

      (db.query as jest.Mock).mockResolvedValue(mockData);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.trends.direction).toBe('decreasing');
      expect(result.narrative).toMatch(/downward|stable/);
      expect(result.trends.changeRate).toBeLessThan(-0.05);
    });

    it('should mention anomalies in narrative when detected', async () => {
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(i === 10 ? 1000 : 100),
      }));

      (db.query as jest.Mock).mockResolvedValue(mockData);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.narrative.toLowerCase()).toMatch(/anomal/);
    });

    it('should mention key drivers in narrative', async () => {
      const mockTimeSeriesData = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: String(100 + i),
      }));

      const mockMetricsData = Array.from({ length: 30 }, (_, i) => ({
        total_applications: String(100 + i * 2),
        active_applications: String(50 + i * 2),
        avg_time_to_fill: String(14),
        placement_rate: String(0.8),
        response_rate: String(0.6),
      }));

      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockTimeSeriesData)
        .mockResolvedValueOnce(mockMetricsData)
        .mockResolvedValueOnce(mockTimeSeriesData)
        .mockResolvedValueOnce([]);

      const result = await insightsService.generateInsights(mockQuery, mockUser);

      expect(result.narrative.toLowerCase()).toMatch(/driver|factor/);
    });
  });
});

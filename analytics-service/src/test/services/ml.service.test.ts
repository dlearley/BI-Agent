import { mlService } from '../../services/ml.service';
import { TimeSeriesPoint } from '../../types';

describe('MLService', () => {
  describe('detectAnomalies', () => {
    it('should detect anomalies using z-score method', () => {
      const data: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 100 },
        { timestamp: '2024-01-02', value: 105 },
        { timestamp: '2024-01-03', value: 98 },
        { timestamp: '2024-01-04', value: 102 },
        { timestamp: '2024-01-05', value: 300 },
        { timestamp: '2024-01-06', value: 99 },
        { timestamp: '2024-01-07', value: 101 },
      ];

      const result = mlService.detectAnomalies(data, {
        method: 'zscore',
        threshold: 2,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.statistics.method).toBe('zscore');
      expect(result.statistics.mean).toBeGreaterThan(0);
      expect(result.statistics.stdDev).toBeGreaterThan(0);
      
      const anomaly = result.anomalies[0];
      expect(anomaly.value).toBe(300);
      expect(anomaly.severity).toBeDefined();
    });

    it('should detect anomalies using ESD method', () => {
      const data: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 50 },
        { timestamp: '2024-01-02', value: 52 },
        { timestamp: '2024-01-03', value: 48 },
        { timestamp: '2024-01-04', value: 51 },
        { timestamp: '2024-01-05', value: 150 },
        { timestamp: '2024-01-06', value: 49 },
        { timestamp: '2024-01-07', value: 50 },
        { timestamp: '2024-01-08', value: 5 },
      ];

      const result = mlService.detectAnomalies(data, {
        method: 'esd',
        threshold: 3,
        alpha: 0.05,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      expect(result.statistics.method).toBe('esd');
      
      const highValueAnomaly = result.anomalies.find(a => a.value === 150);
      expect(highValueAnomaly).toBeDefined();
    });

    it('should handle seasonality in time series data', () => {
      const data: TimeSeriesPoint[] = [];
      for (let i = 0; i < 28; i++) {
        const baseValue = 100;
        const seasonalComponent = i % 7 === 0 || i % 7 === 6 ? 20 : 0;
        data.push({
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
          value: baseValue + seasonalComponent,
        });
      }
      
      data[14].value = 200;

      const result = mlService.detectAnomalies(data, {
        method: 'zscore',
        seasonalPeriod: 7,
        threshold: 2,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      const anomaly = result.anomalies.find(a => a.value === 200);
      expect(anomaly).toBeDefined();
    });

    it('should return empty result for empty data', () => {
      const result = mlService.detectAnomalies([], {
        method: 'zscore',
      });

      expect(result.anomalies).toHaveLength(0);
      expect(result.statistics.mean).toBe(0);
      expect(result.statistics.stdDev).toBe(0);
    });

    it('should classify anomaly severity correctly', () => {
      const data: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 100 },
        { timestamp: '2024-01-02', value: 100 },
        { timestamp: '2024-01-03', value: 100 },
        { timestamp: '2024-01-04', value: 100 },
        { timestamp: '2024-01-05', value: 150 },
        { timestamp: '2024-01-06', value: 250 },
        { timestamp: '2024-01-07', value: 400 },
      ];

      const result = mlService.detectAnomalies(data, {
        method: 'zscore',
        threshold: 1,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      
      const severities = result.anomalies.map(a => a.severity);
      expect(severities).toContain('high');
    });
  });

  describe('analyzeDrivers', () => {
    it('should identify feature importance correctly', () => {
      const features = {
        feature1: [1, 2, 3, 4, 5],
        feature2: [2, 4, 6, 8, 10],
        feature3: [5, 5, 5, 5, 5],
      };
      const target = [10, 20, 30, 40, 50];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'importance',
        topN: 3,
      });

      expect(result.drivers.length).toBeLessThanOrEqual(3);
      expect(result.metadata.totalFeatures).toBe(3);
      expect(result.metadata.samplesAnalyzed).toBe(5);
      
      const topDriver = result.drivers[0];
      expect(topDriver.feature).toBe('feature2');
      expect(topDriver.importance).toBeGreaterThan(0);
      expect(topDriver.direction).toBeDefined();
    });

    it('should calculate correlation-based importance', () => {
      const features = {
        positiveCorr: [1, 2, 3, 4, 5],
        negativeCorr: [5, 4, 3, 2, 1],
        noCorr: [3, 1, 4, 2, 5],
      };
      const target = [10, 20, 30, 40, 50];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'correlation',
        topN: 3,
      });

      expect(result.drivers.length).toBe(3);
      
      const positiveDriver = result.drivers.find(d => d.feature === 'positiveCorr');
      expect(positiveDriver).toBeDefined();
      expect(positiveDriver?.direction).toBe('positive');
      
      const negativeDriver = result.drivers.find(d => d.feature === 'negativeCorr');
      expect(negativeDriver).toBeDefined();
      expect(negativeDriver?.direction).toBe('negative');
    });

    it('should handle features with different variances', () => {
      const features = {
        lowVariance: [10, 10, 10, 10, 10],
        highVariance: [1, 50, 5, 45, 10],
        mediumVariance: [8, 12, 9, 11, 10],
      };
      const target = [20, 30, 25, 28, 22];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'importance',
        topN: 3,
      });

      expect(result.drivers.length).toBeGreaterThan(0);
      result.drivers.forEach(driver => {
        expect(driver.importance).toBeGreaterThanOrEqual(0);
        expect(driver.importance).toBeLessThanOrEqual(1);
      });
    });

    it('should return empty result for empty data', () => {
      const result = mlService.analyzeDrivers({}, [], {
        method: 'importance',
      });

      expect(result.drivers).toHaveLength(0);
      expect(result.metadata.totalFeatures).toBe(0);
      expect(result.metadata.samplesAnalyzed).toBe(0);
    });

    it('should handle mismatched feature lengths', () => {
      const features = {
        feature1: [1, 2, 3],
        feature2: [1, 2],
        feature3: [1, 2, 3],
      };
      const target = [10, 20, 30];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'importance',
      });

      expect(result.drivers.length).toBe(2);
    });

    it('should limit results to topN features', () => {
      const features: Record<string, number[]> = {};
      for (let i = 0; i < 10; i++) {
        features[`feature${i}`] = [1, 2, 3, 4, 5];
      }
      const target = [10, 20, 30, 40, 50];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'importance',
        topN: 3,
      });

      expect(result.drivers.length).toBe(3);
      expect(result.metadata.totalFeatures).toBe(10);
    });

    it('should calculate contribution correctly', () => {
      const features = {
        strongDriver: [10, 20, 30, 40, 50],
        weakDriver: [100, 101, 102, 103, 104],
      };
      const target = [5, 10, 15, 20, 25];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'importance',
        topN: 2,
      });

      const strongDriver = result.drivers.find(d => d.feature === 'strongDriver');
      const weakDriver = result.drivers.find(d => d.feature === 'weakDriver');
      
      expect(strongDriver).toBeDefined();
      expect(weakDriver).toBeDefined();
      expect(Math.abs(strongDriver!.contribution)).toBeGreaterThan(
        Math.abs(weakDriver!.contribution)
      );
    });
  });

  describe('Edge cases', () => {
    it('should handle all identical values in anomaly detection', () => {
      const data: TimeSeriesPoint[] = Array.from({ length: 10 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: 100,
      }));

      const result = mlService.detectAnomalies(data, {
        method: 'zscore',
      });

      expect(result.anomalies).toHaveLength(0);
      expect(result.statistics.stdDev).toBe(0);
    });

    it('should handle single data point', () => {
      const data: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 100 },
      ];

      const result = mlService.detectAnomalies(data, {
        method: 'zscore',
      });

      expect(result.anomalies).toHaveLength(0);
    });

    it('should handle zero variance in driver analysis', () => {
      const features = {
        zeroVariance: [10, 10, 10, 10, 10],
      };
      const target = [20, 25, 30, 35, 40];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'importance',
      });

      expect(result.drivers).toHaveLength(1);
      expect(result.drivers[0].importance).toBeGreaterThanOrEqual(0);
    });
  });
});

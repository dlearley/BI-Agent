import { mlService } from '../../services/ml.service';
import { TimeSeriesPoint } from '../../types';

describe('Insights Integration Tests with Demo Data', () => {
  describe('Complete workflow with synthetic healthcare data', () => {
    it('should detect anomalies in application volume', () => {
      const demoData: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 45 },
        { timestamp: '2024-01-02', value: 48 },
        { timestamp: '2024-01-03', value: 52 },
        { timestamp: '2024-01-04', value: 47 },
        { timestamp: '2024-01-05', value: 49 },
        { timestamp: '2024-01-06', value: 46 },
        { timestamp: '2024-01-07', value: 44 },
        { timestamp: '2024-01-08', value: 51 },
        { timestamp: '2024-01-09', value: 48 },
        { timestamp: '2024-01-10', value: 120 },
        { timestamp: '2024-01-11', value: 50 },
        { timestamp: '2024-01-12', value: 47 },
        { timestamp: '2024-01-13', value: 49 },
        { timestamp: '2024-01-14', value: 46 },
        { timestamp: '2024-01-15', value: 5 },
        { timestamp: '2024-01-16', value: 48 },
      ];

      const result = mlService.detectAnomalies(demoData, {
        method: 'zscore',
        threshold: 2,
        seasonalPeriod: 7,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      
      const highAnomaly = result.anomalies.find(a => a.value === 120);
      expect(highAnomaly).toBeDefined();
      expect(highAnomaly?.severity).toBeDefined();

      const extremeAnomalies = result.anomalies.filter(a => a.value === 120 || a.value === 5);
      expect(extremeAnomalies.length).toBeGreaterThan(0);

      expect(result.statistics.mean).toBeGreaterThan(0);
      expect(result.statistics.stdDev).toBeGreaterThan(0);
    });

    it('should analyze recruitment drivers', () => {
      const demoFeatures = {
        job_postings: [10, 15, 12, 18, 20, 22, 25, 28, 30, 32],
        response_rate: [0.3, 0.35, 0.32, 0.38, 0.40, 0.42, 0.45, 0.48, 0.50, 0.52],
        avg_salary_offered: [75000, 76000, 75500, 77000, 78000, 79000, 80000, 81000, 82000, 83000],
        time_to_respond: [2.5, 2.3, 2.4, 2.1, 2.0, 1.9, 1.8, 1.7, 1.6, 1.5],
        facility_rating: [4.2, 4.2, 4.3, 4.3, 4.4, 4.4, 4.5, 4.5, 4.6, 4.6],
      };

      const demoTarget = [25, 32, 28, 38, 45, 48, 55, 62, 68, 72];

      const result = mlService.analyzeDrivers(demoFeatures, demoTarget, {
        method: 'importance',
        topN: 5,
      });

      expect(result.drivers.length).toBeGreaterThan(0);
      expect(result.drivers.length).toBeLessThanOrEqual(5);

      result.drivers.forEach(driver => {
        expect(driver.feature).toBeDefined();
        expect(driver.importance).toBeGreaterThanOrEqual(0);
        expect(driver.importance).toBeLessThanOrEqual(1);
        expect(['positive', 'negative']).toContain(driver.direction);
        expect(typeof driver.contribution).toBe('number');
      });

      expect(result.metadata.totalFeatures).toBe(5);
      expect(result.metadata.samplesAnalyzed).toBe(10);
      expect(result.metadata.method).toBe('importance');
    });

    it('should handle weekly seasonal patterns', () => {
      const weeklyPattern: TimeSeriesPoint[] = [];
      
      for (let week = 0; week < 8; week++) {
        for (let day = 0; day < 7; day++) {
          const isWeekend = day === 5 || day === 6;
          const baseValue = 50;
          const weekendDrop = isWeekend ? -15 : 0;
          const noise = Math.random() * 5 - 2.5;
          const anomalySpike = (week === 4 && day === 2) ? 50 : 0;
          
          weeklyPattern.push({
            timestamp: `2024-01-${String(week * 7 + day + 1).padStart(2, '0')}`,
            value: baseValue + weekendDrop + noise + anomalySpike,
          });
        }
      }

      const result = mlService.detectAnomalies(weeklyPattern, {
        method: 'esd',
        seasonalPeriod: 7,
        threshold: 5,
        alpha: 0.05,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      
      const anomalyValue = result.anomalies.find(a => a.value > 95);
      expect(anomalyValue).toBeDefined();
    });

    it('should identify compliance violations patterns', () => {
      const complianceData: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 0.98 },
        { timestamp: '2024-01-02', value: 0.97 },
        { timestamp: '2024-01-03', value: 0.96 },
        { timestamp: '2024-01-04', value: 0.98 },
        { timestamp: '2024-01-05', value: 0.97 },
        { timestamp: '2024-01-06', value: 0.85 },
        { timestamp: '2024-01-07', value: 0.97 },
        { timestamp: '2024-01-08', value: 0.98 },
        { timestamp: '2024-01-09', value: 0.82 },
        { timestamp: '2024-01-10', value: 0.96 },
      ];

      const result = mlService.detectAnomalies(complianceData, {
        method: 'zscore',
        threshold: 2,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      
      const lowComplianceAnomalies = result.anomalies.filter(a => a.value < 0.90);
      expect(lowComplianceAnomalies.length).toBeGreaterThan(0);
    });

    it('should analyze revenue drivers', () => {
      const revenueFeatures = {
        placements: [5, 7, 6, 9, 10, 12, 11, 14, 15, 18],
        avg_contract_value: [25000, 26000, 25500, 27000, 28000, 29000, 28500, 30000, 31000, 32000],
        client_satisfaction: [4.1, 4.2, 4.1, 4.3, 4.4, 4.5, 4.4, 4.6, 4.7, 4.8],
        time_to_placement: [21, 20, 22, 19, 18, 17, 18, 16, 15, 14],
      };

      const revenueTarget = [125000, 182000, 153000, 243000, 280000, 348000, 313500, 420000, 465000, 576000];

      const result = mlService.analyzeDrivers(revenueFeatures, revenueTarget, {
        method: 'importance',
        topN: 4,
      });

      expect(result.drivers.length).toBe(4);

      const placementsDriver = result.drivers.find(d => d.feature === 'placements');
      expect(placementsDriver).toBeDefined();
      expect(placementsDriver?.direction).toBe('positive');
      expect(placementsDriver?.importance).toBeGreaterThan(0.7);

      const topDriver = result.drivers[0];
      expect(topDriver.importance).toBeGreaterThanOrEqual(result.drivers[1].importance);
    });

    it('should handle multi-facility data with varying patterns', () => {
      const facility1Data: TimeSeriesPoint[] = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: 40 + Math.sin(i * 0.5) * 5,
      }));

      const facility2Data: TimeSeriesPoint[] = Array.from({ length: 30 }, (_, i) => ({
        timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
        value: 60 + Math.cos(i * 0.3) * 8,
      }));

      const result1 = mlService.detectAnomalies(facility1Data, {
        method: 'zscore',
        threshold: 2.5,
      });

      const result2 = mlService.detectAnomalies(facility2Data, {
        method: 'zscore',
        threshold: 2.5,
      });

      expect(result1.statistics.mean).not.toBe(result2.statistics.mean);
      expect(result1.statistics.stdDev).not.toBe(result2.statistics.stdDev);
    });

    it('should detect sudden trend changes', () => {
      const trendChangeData: TimeSeriesPoint[] = [];
      
      for (let i = 0; i < 15; i++) {
        trendChangeData.push({
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
          value: 100 + i * 2,
        });
      }
      
      for (let i = 15; i < 30; i++) {
        trendChangeData.push({
          timestamp: `2024-01-${String(i + 1).padStart(2, '0')}`,
          value: 130 - (i - 15) * 3,
        });
      }

      const result = mlService.detectAnomalies(trendChangeData, {
        method: 'esd',
        threshold: 3,
        alpha: 0.05,
      });

      expect(result.statistics).toBeDefined();
      expect(result.statistics.mean).toBeGreaterThan(0);
    });

    it('should handle correlation-based driver analysis', () => {
      const correlationFeatures = {
        perfect_positive: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        perfect_negative: [10, 9, 8, 7, 6, 5, 4, 3, 2, 1],
        no_correlation: [5, 2, 8, 1, 9, 3, 7, 4, 6, 10],
        moderate_positive: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
      };

      const target = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

      const result = mlService.analyzeDrivers(correlationFeatures, target, {
        method: 'correlation',
        topN: 4,
      });

      expect(result.drivers.length).toBe(4);

      const perfectDriver = result.drivers.find(d => d.feature === 'perfect_positive');
      expect(perfectDriver).toBeDefined();
      expect(perfectDriver?.importance).toBeGreaterThan(0.95);
      expect(perfectDriver?.direction).toBe('positive');

      const negativeDriver = result.drivers.find(d => d.feature === 'perfect_negative');
      expect(negativeDriver).toBeDefined();
      expect(negativeDriver?.direction).toBe('negative');

      const noCorrDriver = result.drivers.find(d => d.feature === 'no_correlation');
      expect(noCorrDriver?.importance).toBeLessThan(perfectDriver!.importance);
    });

    it('should provide consistent results for same input', () => {
      const data: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 100 },
        { timestamp: '2024-01-02', value: 105 },
        { timestamp: '2024-01-03', value: 300 },
        { timestamp: '2024-01-04', value: 102 },
      ];

      const result1 = mlService.detectAnomalies(data, {
        method: 'zscore',
        threshold: 2,
      });

      const result2 = mlService.detectAnomalies(data, {
        method: 'zscore',
        threshold: 2,
      });

      expect(result1.anomalies.length).toBe(result2.anomalies.length);
      expect(result1.statistics.mean).toBe(result2.statistics.mean);
      expect(result1.statistics.stdDev).toBe(result2.statistics.stdDev);
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle very small datasets', () => {
      const smallData: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: 100 },
        { timestamp: '2024-01-02', value: 200 },
      ];

      const result = mlService.detectAnomalies(smallData, {
        method: 'zscore',
      });

      expect(result).toBeDefined();
      expect(result.statistics).toBeDefined();
    });

    it('should handle datasets with negative values', () => {
      const negativeData: TimeSeriesPoint[] = [
        { timestamp: '2024-01-01', value: -10 },
        { timestamp: '2024-01-02', value: -12 },
        { timestamp: '2024-01-03', value: -50 },
        { timestamp: '2024-01-04', value: -11 },
      ];

      const result = mlService.detectAnomalies(negativeData, {
        method: 'zscore',
        threshold: 1.5,
      });

      expect(result.anomalies.length).toBeGreaterThan(0);
      const anomaly = result.anomalies.find(a => a.value === -50);
      expect(anomaly).toBeDefined();
    });

    it('should handle features with zero variance', () => {
      const features = {
        constant: [5, 5, 5, 5, 5],
        varying: [1, 2, 3, 4, 5],
      };
      const target = [10, 20, 30, 40, 50];

      const result = mlService.analyzeDrivers(features, target, {
        method: 'importance',
      });

      expect(result.drivers.length).toBe(2);
    });

    it('should handle large datasets efficiently', () => {
      const largeData: TimeSeriesPoint[] = Array.from({ length: 1000 }, (_, i) => ({
        timestamp: `2024-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
        value: 100 + Math.sin(i * 0.1) * 20 + (i === 500 ? 200 : 0),
      }));

      const startTime = Date.now();
      const result = mlService.detectAnomalies(largeData, {
        method: 'esd',
        threshold: 10,
        alpha: 0.05,
      });
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000);
      expect(result.anomalies.length).toBeGreaterThan(0);
    });
  });
});

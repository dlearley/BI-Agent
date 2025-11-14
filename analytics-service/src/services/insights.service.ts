import { mlService } from './ml.service';
import { analyticsService } from './analytics.service';
import { db } from '../config/database';
import {
  InsightsReport,
  TimeSeriesPoint,
  TrendAnalysis,
  User,
  AnalyticsQuery,
} from '../types';

export class InsightsService {
  async generateInsights(query: AnalyticsQuery, user: User): Promise<InsightsReport> {
    const [anomalies, drivers, trends] = await Promise.all([
      this.analyzeAnomalies(query, user),
      this.analyzeDrivers(query, user),
      this.analyzeTrends(query, user),
    ]);

    const narrative = this.generateNarrative(anomalies, drivers, trends);

    const report: InsightsReport = {
      id: this.generateReportId(),
      timestamp: new Date().toISOString(),
      query,
      anomalies,
      drivers,
      trends,
      narrative,
    };

    await this.saveReport(report);

    return report;
  }

  private async analyzeAnomalies(query: AnalyticsQuery, user: User) {
    const timeSeriesData = await this.getTimeSeriesData(query, user);

    const anomaliesResult = mlService.detectAnomalies(timeSeriesData, {
      method: 'esd',
      seasonalPeriod: 7,
      threshold: 3,
      alpha: 0.05,
    });

    return {
      detected: anomaliesResult.anomalies,
      statistics: anomaliesResult.statistics,
      totalPoints: timeSeriesData.length,
      anomalyRate: timeSeriesData.length > 0
        ? anomaliesResult.anomalies.length / timeSeriesData.length
        : 0,
    };
  }

  private async analyzeDrivers(query: AnalyticsQuery, user: User) {
    const metricsData = await this.getMetricsData(query, user);

    if (!metricsData.target || !metricsData.features) {
      return {
        topDrivers: [],
        metadata: {
          method: 'importance',
          totalFeatures: 0,
          samplesAnalyzed: 0,
        },
      };
    }

    const driversResult = mlService.analyzeDrivers(
      metricsData.features,
      metricsData.target,
      {
        method: 'importance',
        topN: 5,
      }
    );

    return {
      topDrivers: driversResult.drivers,
      metadata: driversResult.metadata,
    };
  }

  private async analyzeTrends(query: AnalyticsQuery, user: User): Promise<TrendAnalysis> {
    const timeSeriesData = await this.getTimeSeriesData(query, user);

    if (timeSeriesData.length < 2) {
      return {
        direction: 'stable',
        strength: 0,
        variance: 0,
        changeRate: 0,
      };
    }

    const values = timeSeriesData.map(d => d.value);
    const trend = this.calculateTrend(values);
    const variance = this.calculateVariance(values);

    return {
      direction: trend > 0.05 ? 'increasing' : trend < -0.05 ? 'decreasing' : 'stable',
      strength: Math.abs(trend),
      variance,
      changeRate: trend,
    };
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const indices = Array.from({ length: n }, (_, i) => i);

    const meanX = indices.reduce((sum, val) => sum + val, 0) / n;
    const meanY = values.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      const dx = indices[i] - meanX;
      const dy = values[i] - meanY;
      numerator += dx * dy;
      denominator += dx * dx;
    }

    if (denominator === 0) return 0;

    const slope = numerator / denominator;
    const normalizedSlope = meanY !== 0 ? slope / meanY : slope;

    return normalizedSlope;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;

    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squareDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;

    return variance;
  }

  private generateNarrative(
    anomalies: any,
    drivers: any,
    trends: TrendAnalysis
  ): string {
    const narrativeParts: string[] = [];

    narrativeParts.push(this.generateTrendNarrative(trends));
    narrativeParts.push(this.generateAnomalyNarrative(anomalies));
    narrativeParts.push(this.generateDriversNarrative(drivers));

    return narrativeParts.filter(part => part.length > 0).join(' ');
  }

  private generateTrendNarrative(trends: TrendAnalysis): string {
    const { direction, strength, variance } = trends;

    let narrative = '';

    if (direction === 'increasing') {
      narrative += `Metrics show an upward trend with ${(strength * 100).toFixed(1)}% growth rate.`;
    } else if (direction === 'decreasing') {
      narrative += `Metrics show a downward trend with ${(strength * 100).toFixed(1)}% decline rate.`;
    } else {
      narrative += 'Metrics remain relatively stable with no significant trend.';
    }

    if (variance > 100) {
      narrative += ' High variance indicates significant fluctuations in the data.';
    } else if (variance > 10) {
      narrative += ' Moderate variance suggests some fluctuations in performance.';
    } else {
      narrative += ' Low variance indicates consistent performance.';
    }

    return narrative;
  }

  private generateAnomalyNarrative(anomalies: any): string {
    const { detected, anomalyRate, totalPoints } = anomalies;

    if (detected.length === 0) {
      return 'No significant anomalies detected in the analyzed period.';
    }

    const highSeverityCount = detected.filter((a: any) => a.severity === 'high').length;
    const mediumSeverityCount = detected.filter((a: any) => a.severity === 'medium').length;

    let narrative = `Detected ${detected.length} anomal${detected.length === 1 ? 'y' : 'ies'} out of ${totalPoints} data points (${(anomalyRate * 100).toFixed(1)}% anomaly rate).`;

    if (highSeverityCount > 0) {
      narrative += ` ${highSeverityCount} high-severity anomal${highSeverityCount === 1 ? 'y requires' : 'ies require'} immediate attention.`;
    } else if (mediumSeverityCount > 0) {
      narrative += ` ${mediumSeverityCount} medium-severity anomal${mediumSeverityCount === 1 ? 'y' : 'ies'} detected.`;
    }

    return narrative;
  }

  private generateDriversNarrative(drivers: any): string {
    const { topDrivers } = drivers;

    if (topDrivers.length === 0) {
      return 'Insufficient data to determine key performance drivers.';
    }

    const topDriver = topDrivers[0];
    const narrative = `Key performance driver: ${topDriver.feature} with ${(topDriver.importance * 100).toFixed(1)}% importance and ${topDriver.direction} contribution.`;

    if (topDrivers.length > 1) {
      const otherDrivers = topDrivers
        .slice(1, 3)
        .map((d: any) => d.feature)
        .join(', ');
      return `${narrative} Other significant factors include ${otherDrivers}.`;
    }

    return narrative;
  }

  private async getTimeSeriesData(query: AnalyticsQuery, user: User): Promise<TimeSeriesPoint[]> {
    try {
      const facilityFilter = user.facilityId
        ? `AND facility_id = '${user.facilityId}'`
        : query.facilityId
        ? `AND facility_id = '${query.facilityId}'`
        : '';

      const dateFilter = query.startDate && query.endDate
        ? `AND date >= '${query.startDate}' AND date <= '${query.endDate}'`
        : '';

      const result = await db.query<any>(`
        SELECT 
          date::text as timestamp,
          total_applications as value
        FROM analytics.pipeline_kpis
        WHERE 1=1
          ${facilityFilter}
          ${dateFilter}
        ORDER BY date ASC
        LIMIT 1000
      `);

      return result.map((row: any) => ({
        timestamp: row.timestamp,
        value: parseFloat(row.value) || 0,
      }));
    } catch (error) {
      console.error('Error fetching time series data:', error);
      return [];
    }
  }

  private async getMetricsData(query: AnalyticsQuery, user: User): Promise<{
    target: number[];
    features: Record<string, number[]>;
  }> {
    try {
      const facilityFilter = user.facilityId
        ? `AND facility_id = '${user.facilityId}'`
        : query.facilityId
        ? `AND facility_id = '${query.facilityId}'`
        : '';

      const dateFilter = query.startDate && query.endDate
        ? `AND date >= '${query.startDate}' AND date <= '${query.endDate}'`
        : '';

      const result = await db.query<any>(`
        SELECT 
          total_applications,
          active_applications,
          avg_time_to_fill,
          placement_rate,
          response_rate
        FROM analytics.pipeline_kpis
        WHERE 1=1
          ${facilityFilter}
          ${dateFilter}
        ORDER BY date ASC
        LIMIT 1000
      `);

      if (result.length === 0) {
        return { target: [], features: {} };
      }

      const target = result.map((row: any) => parseFloat(row.total_applications) || 0);
      const features: Record<string, number[]> = {
        active_applications: result.map((row: any) => parseFloat(row.active_applications) || 0),
        avg_time_to_fill: result.map((row: any) => parseFloat(row.avg_time_to_fill) || 0),
        placement_rate: result.map((row: any) => parseFloat(row.placement_rate) || 0),
        response_rate: result.map((row: any) => parseFloat(row.response_rate) || 0),
      };

      return { target, features };
    } catch (error) {
      console.error('Error fetching metrics data:', error);
      return { target: [], features: {} };
    }
  }

  private async saveReport(report: InsightsReport): Promise<void> {
    try {
      await db.query(`
        INSERT INTO analytics.insights_reports (
          id,
          timestamp,
          query_params,
          anomalies,
          drivers,
          trends,
          narrative
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (id) DO UPDATE SET
          timestamp = EXCLUDED.timestamp,
          query_params = EXCLUDED.query_params,
          anomalies = EXCLUDED.anomalies,
          drivers = EXCLUDED.drivers,
          trends = EXCLUDED.trends,
          narrative = EXCLUDED.narrative
      `, [
        report.id,
        report.timestamp,
        JSON.stringify(report.query),
        JSON.stringify(report.anomalies),
        JSON.stringify(report.drivers),
        JSON.stringify(report.trends),
        report.narrative,
      ]);
    } catch (error) {
      console.error('Error saving report:', error);
    }
  }

  async getReport(reportId: string): Promise<InsightsReport | null> {
    try {
      const result = await db.query<any>(`
        SELECT 
          id,
          timestamp,
          query_params,
          anomalies,
          drivers,
          trends,
          narrative
        FROM analytics.insights_reports
        WHERE id = $1
      `, [reportId]);

      if (result.length === 0) {
        return null;
      }

      const row = result[0];
      return {
        id: row.id,
        timestamp: row.timestamp,
        query: JSON.parse(row.query_params),
        anomalies: JSON.parse(row.anomalies),
        drivers: JSON.parse(row.drivers),
        trends: JSON.parse(row.trends),
        narrative: row.narrative,
      };
    } catch (error) {
      console.error('Error fetching report:', error);
      return null;
    }
  }

  private generateReportId(): string {
    return `insight_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const insightsService = new InsightsService();

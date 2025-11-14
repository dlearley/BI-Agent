import { Request, Response } from 'express';
import { insightsService } from '../services/insights.service';
import { mlService } from '../services/ml.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { AnalyticsQuery, TimeSeriesPoint } from '../types';
import { z } from 'zod';

const insightsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  facilityId: z.string().optional(),
  includePII: z.boolean().optional(),
});

const anomalyDetectSchema = z.object({
  data: z.array(z.object({
    timestamp: z.string(),
    value: z.number(),
  })),
  method: z.enum(['esd', 'zscore']).optional(),
  seasonalPeriod: z.number().optional(),
  threshold: z.number().optional(),
  alpha: z.number().optional(),
});

const driversSchema = z.object({
  features: z.record(z.array(z.number())),
  target: z.array(z.number()),
  method: z.enum(['correlation', 'importance']).optional(),
  topN: z.number().optional(),
});

export class InsightsController {
  async getInsights(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = insightsQuerySchema.parse(req.query) as AnalyticsQuery;
      const user = req.user!;

      const insights = await insightsService.generateInsights(query, user);

      res.json({
        success: true,
        data: insights,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error generating insights:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate insights',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reportId } = req.params;
      const user = req.user!;

      const report = await insightsService.getReport(reportId);

      if (!report) {
        res.status(404).json({
          success: false,
          error: 'Report not found',
        });
        return;
      }

      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async detectAnomalies(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = anomalyDetectSchema.parse(req.body);
      const { data, method, seasonalPeriod, threshold, alpha } = validated;

      const result = mlService.detectAnomalies(data as TimeSeriesPoint[], {
        method,
        seasonalPeriod,
        threshold,
        alpha,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error detecting anomalies:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to detect anomalies',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async analyzeDrivers(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validated = driversSchema.parse(req.body);
      const { features, target, method, topN } = validated;

      const result = mlService.analyzeDrivers(features, target, {
        method,
        topN,
      });

      res.json({
        success: true,
        data: result,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error analyzing drivers:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze drivers',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const insightsController = new InsightsController();

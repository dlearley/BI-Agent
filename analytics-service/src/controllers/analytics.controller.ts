import { Request, Response } from 'express';
import { analyticsService } from '../services/analytics.service';
import { queueService } from '../services/queue.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { AnalyticsQuery } from '../types';
import { z } from 'zod';

const analyticsQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  facilityId: z.string().optional(),
  includePII: z.boolean().optional(),
});

export class AnalyticsController {
  async getPipelineKPIs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = analyticsQuerySchema.parse(req.query) as AnalyticsQuery;
      const user = req.user!;

      const kpis = await analyticsService.getPipelineKPIs(query, user);
      
      res.json({
        success: true,
        data: kpis,
        cached: false, // Would be determined by cache hit logic
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching pipeline KPIs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pipeline KPIs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getComplianceMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = analyticsQuerySchema.parse(req.query) as AnalyticsQuery;
      const user = req.user!;

      const metrics = await analyticsService.getComplianceMetrics(query, user);
      
      res.json({
        success: true,
        data: metrics,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching compliance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch compliance metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getRevenueMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = analyticsQuerySchema.parse(req.query) as AnalyticsQuery;
      const user = req.user!;

      const metrics = await analyticsService.getRevenueMetrics(query, user);
      
      res.json({
        success: true,
        data: metrics,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching revenue metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch revenue metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getOutreachMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = analyticsQuerySchema.parse(req.query) as AnalyticsQuery;
      const user = req.user!;

      const metrics = await analyticsService.getOutreachMetrics(query, user);
      
      res.json({
        success: true,
        data: metrics,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching outreach metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch outreach metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getCombinedKPIs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = analyticsQuerySchema.parse(req.query) as AnalyticsQuery;
      const user = req.user!;

      const kpis = await analyticsService.getCombinedKPIs(query, user);
      
      res.json({
        success: true,
        data: kpis,
        cached: false,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching combined KPIs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch combined KPIs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async refreshAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { viewName } = req.body;
      const user = req.user!;

      // Only admins can trigger manual refreshes
      if (user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Only administrators can trigger manual refreshes',
        });
        return;
      }

      // Enqueue refresh job
      const job = await queueService.enqueueRefreshJob(viewName);
      
      res.json({
        success: true,
        message: 'Analytics refresh job enqueued successfully',
        data: {
          jobId: job.id,
          viewName: viewName || 'all',
          estimatedDelay: job.opts.delay || 0,
        },
      });
    } catch (error) {
      console.error('Error enqueuing refresh job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to enqueue refresh job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getRefreshStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = req.user!;

      // Only admins can check job status
      if (user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Only administrators can check refresh status',
        });
        return;
      }

      const jobStatus = await queueService.getJobStatus(jobId);
      
      res.json({
        success: true,
        data: jobStatus,
      });
    } catch (error) {
      console.error('Error fetching job status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch job status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getQueueStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Only admins can view queue stats
      if (user.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Only administrators can view queue statistics',
        });
        return;
      }

      const stats = await queueService.getQueueStats();
      
      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      console.error('Error fetching queue stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch queue statistics',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getLastRefreshTimes(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      const refreshTimes = await analyticsService.getLastRefreshTimes();
      
      res.json({
        success: true,
        data: refreshTimes,
      });
    } catch (error) {
      console.error('Error fetching last refresh times:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch last refresh times',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAnalyticsHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const user = req.user!;

      // Get database and Redis health status
      const [dbHealth, redisHealth] = await Promise.all([
        // Simple health check queries
        Promise.resolve(true), // Would implement actual health checks
        Promise.resolve(true),
      ]);

      const lastRefresh = await analyticsService.getLastRefreshTimes();
      const queueStats = user.role === 'admin' 
        ? await queueService.getQueueStats() 
        : null;

      res.json({
        success: true,
        data: {
          database: dbHealth ? 'healthy' : 'unhealthy',
          redis: redisHealth ? 'healthy' : 'unhealthy',
          lastRefresh,
          queueStats,
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error('Error fetching analytics health:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch analytics health',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const analyticsController = new AnalyticsController();
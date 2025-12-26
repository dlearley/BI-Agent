import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { exportService } from '../services/export.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  DashboardQuery, 
  DashboardType, 
  SavedView, 
  DrilldownConfig,
  Permission,
  User
} from '../types';
import { z } from 'zod';

const dashboardQuerySchema = z.object({
  dashboardType: z.nativeEnum(DashboardType).optional(),
  viewId: z.string().optional(),
  team: z.array(z.string()).optional(),
  rep: z.array(z.string()).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  pipeline: z.array(z.string()).optional(),
  facilityId: z.string().optional(),
  includePII: z.boolean().optional(),
  timeRange: z.object({
    preset: z.enum(['today', 'yesterday', 'last7days', 'last30days', 'last90days', 'thismonth', 'lastmonth', 'thisyear', 'custom']).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }).optional(),
  includeDrilldowns: z.boolean().optional(),
  format: z.enum(['json', 'csv']).optional(),
  limit: z.number().min(1).max(10000).optional(),
  offset: z.number().min(0).optional(),
});

const savedViewSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  dashboardType: z.nativeEnum(DashboardType),
  filters: z.object({}).optional(),
  layout: z.any().optional(),
  isPublic: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});

const drilldownConfigSchema = z.object({
  viewId: z.string().optional(),
  metricName: z.string().min(1),
  drilldownPath: z.array(z.object({
    level: z.number(),
    dimension: z.string(),
    aggregation: z.string().optional(),
    filters: z.object({}).optional(),
  })),
  targetTable: z.string().min(1),
  filters: z.object({}).optional(),
});

export class DashboardController {
  async getDashboardData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = dashboardQuerySchema.parse(req.query) as DashboardQuery;
      const user = req.user!;

      const response = await dashboardService.getDashboardData(query, user);
      
      res.json(response);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createSavedView(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = savedViewSchema.parse(req.body);
      const user = req.user!;

      const savedView = await dashboardService.createSavedView({
        ...validatedData,
        userId: user.id,
        filters: validatedData.filters || {},
        layout: validatedData.layout || undefined,
      }, user);
      
      res.status(201).json({
        success: true,
        data: savedView,
      });
    } catch (error) {
      console.error('Error creating saved view:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create saved view',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getSavedViews(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardType } = req.query;
      const user = req.user!;

      const savedViews = await dashboardService.getSavedViews(
        user, 
        dashboardType as DashboardType
      );
      
      res.json({
        success: true,
        data: savedViews,
      });
    } catch (error) {
      console.error('Error fetching saved views:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch saved views',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateSavedView(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const updates = savedViewSchema.partial().parse(req.body);
      const user = req.user!;

      const savedView = await dashboardService.updateSavedView(id, updates, user);
      
      res.json({
        success: true,
        data: savedView,
      });
    } catch (error) {
      console.error('Error updating saved view:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update saved view',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteSavedView(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      await dashboardService.deleteSavedView(id, user);
      
      res.json({
        success: true,
        message: 'Saved view deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting saved view:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete saved view',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createDrilldownConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = drilldownConfigSchema.parse(req.body);
      const user = req.user!;

      const drilldownConfig = await dashboardService.createDrilldownConfig({
        ...validatedData,
        userId: user.id,
        filters: validatedData.filters || {},
      }, user);
      
      res.status(201).json({
        success: true,
        data: drilldownConfig,
      });
    } catch (error) {
      console.error('Error creating drilldown config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create drilldown config',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getDrilldownConfigs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { viewId } = req.query;
      const user = req.user!;

      const drilldownConfigs = await dashboardService.getDrilldownConfigs(user, viewId as string);
      
      res.json({
        success: true,
        data: drilldownConfigs,
      });
    } catch (error) {
      console.error('Error fetching drilldown configs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch drilldown configs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createExportJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = dashboardQuerySchema.parse(req.body);
      const user = req.user!;

      // Check export permission
      if (!user.permissions.includes(Permission.EXPORT_DATA)) {
        res.status(403).json({
          success: false,
          error: 'Export permission required',
        });
        return;
      }

      const exportJob = await dashboardService.createExportJob(query, user);
      
      // Start the export process asynchronously
      this.processExport(exportJob.id, query, user).catch(error => {
        console.error('Export processing failed:', error);
      });
      
      res.status(201).json({
        success: true,
        data: exportJob,
      });
    } catch (error) {
      console.error('Error creating export job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create export job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getExportJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = req.user!;

      const exportJob = await dashboardService.getExportJob(jobId, user);
      
      if (!exportJob) {
        res.status(404).json({
          success: false,
          error: 'Export job not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: exportJob,
      });
    } catch (error) {
      console.error('Error fetching export job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export job',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getExportJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { status } = req.query;
      const user = req.user!;

      const exportJobs = await dashboardService.getExportJobs(user, status as any);
      
      res.json({
        success: true,
        data: exportJobs,
      });
    } catch (error) {
      console.error('Error fetching export jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export jobs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async downloadExport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const user = req.user!;

      const exportJob = await dashboardService.getExportJob(jobId, user);
      
      if (!exportJob) {
        res.status(404).json({
          success: false,
          error: 'Export job not found',
        });
        return;
      }

      if (exportJob.status !== 'completed') {
        res.status(400).json({
          success: false,
          error: 'Export is not ready for download',
        });
        return;
      }

      if (!exportJob.filePath) {
        res.status(404).json({
          success: false,
          error: 'Export file not found',
        });
        return;
      }

      const csvStream = await exportService.getCSVStream(exportJob.filePath, user);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="export_${jobId}.csv"`);
      res.setHeader('Content-Length', exportJob.fileSize);

      csvStream.pipe(res);
    } catch (error) {
      console.error('Error downloading export:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to download export',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async processExport(jobId: string, query: DashboardQuery, user: User): Promise<void> {
    try {
      await exportService.streamToCSV(query, user, jobId);
    } catch (error) {
      console.error('Export processing failed:', error);
      
      // Update job status to failed
      await dashboardService.updateExportJob(jobId, {
        status: 'failed' as any,
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }, user);
    }
  }
}

export const dashboardController = new DashboardController();
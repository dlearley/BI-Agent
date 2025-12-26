import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { dashboardJobService } from '../services/dashboard-job.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  CreateDashboardRequest,
  UpdateDashboardRequest,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  CreateQueryRequest,
  DashboardQueryOptions,
  WidgetDataRequest,
  ExportRequest,
  Permission
} from '../types';
import { z } from 'zod';

// Validation schemas
const createDashboardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  layout: z.any().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional()
});

const updateDashboardSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  layout: z.any().optional(),
  tags: z.array(z.string()).optional(),
  isPublic: z.boolean().optional()
});

const createWidgetSchema = z.object({
  dashboardId: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: z.enum(['kpi', 'line', 'area', 'bar', 'table', 'heatmap', 'map']),
  queryId: z.string().uuid(),
  config: z.any(),
  position: z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  }),
  drillThroughConfig: z.any().optional(),
  crossFilters: z.array(z.any()).optional(),
  refreshInterval: z.number().min(60).optional()
});

const updateWidgetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.any().optional(),
  position: z.object({
    id: z.string(),
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  }).optional(),
  drillThroughConfig: z.any().optional(),
  crossFilters: z.array(z.any()).optional(),
  refreshInterval: z.number().min(60).optional()
});

const createQuerySchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  queryText: z.string().min(1),
  queryType: z.enum(['sql', 'materialized_view']).optional(),
  materializedViewName: z.string().optional(),
  parameters: z.array(z.object({
    name: z.string(),
    type: z.enum(['string', 'number', 'date', 'boolean']),
    required: z.boolean(),
    defaultValue: z.any().optional(),
    description: z.string().optional()
  })).optional(),
  isTemplate: z.boolean().optional()
});

const widgetDataSchema = z.object({
  widgetId: z.string().uuid(),
  parameters: z.record(z.any()).optional(),
  forceRefresh: z.boolean().optional(),
  useCache: z.boolean().optional()
});

const exportRequestSchema = z.object({
  dashboardId: z.string().uuid(),
  exportType: z.enum(['pdf', 'png']),
  formatOptions: z.any().optional(),
  widgetIds: z.array(z.string().uuid()).optional(),
  filters: z.record(z.any()).optional()
});

const dashboardQuerySchema = z.object({
  includeWidgets: z.boolean().optional(),
  includeVersions: z.boolean().optional(),
  includeShares: z.boolean().optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
  tags: z.array(z.string()).optional(),
  createdBy: z.string().uuid().optional(),
  facilityId: z.string().uuid().optional()
});

export class DashboardController {
  // Dashboard endpoints
  async createDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = createDashboardSchema.parse(req.body) as CreateDashboardRequest;
      const user = req.user!;

      const dashboard = await dashboardService.createDashboard(validatedData, user);
      
      res.status(201).json({
        success: true,
        data: dashboard,
        message: 'Dashboard created successfully'
      });
    } catch (error) {
      console.error('Error creating dashboard:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to create dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const queryOptions = dashboardQuerySchema.parse(req.query) as DashboardQueryOptions;
      const user = req.user!;

      const dashboard = await dashboardService.getDashboard(id, user, queryOptions);
      
      if (!dashboard) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      console.error('Error fetching dashboard:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getDashboards(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const queryOptions = dashboardQuerySchema.parse(req.query) as DashboardQueryOptions;
      const user = req.user!;

      const dashboards = await dashboardService.getDashboards(user, queryOptions);
      
      res.json({
        success: true,
        data: dashboards,
        count: dashboards.length
      });
    } catch (error) {
      console.error('Error fetching dashboards:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to fetch dashboards',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateDashboardSchema.parse(req.body) as UpdateDashboardRequest;
      const user = req.user!;

      const dashboard = await dashboardService.updateDashboard(id, validatedData, user);
      
      if (!dashboard) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: dashboard,
        message: 'Dashboard updated successfully'
      });
    } catch (error) {
      console.error('Error updating dashboard:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to update dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      const success = await dashboardService.deleteDashboard(id, user);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Dashboard deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async publishDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      const dashboard = await dashboardService.publishDashboard(id, user);
      
      if (!dashboard) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: dashboard,
        message: 'Dashboard published successfully'
      });
    } catch (error) {
      console.error('Error publishing dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to publish dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Widget endpoints
  async createWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = createWidgetSchema.parse(req.body) as CreateWidgetRequest;
      const user = req.user!;

      const widget = await dashboardService.createWidget(validatedData, user);
      
      res.status(201).json({
        success: true,
        data: widget,
        message: 'Widget created successfully'
      });
    } catch (error) {
      console.error('Error creating widget:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to create widget',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      const widget = await dashboardService.getWidget(id, user);
      
      if (!widget) {
        res.status(404).json({
          success: false,
          error: 'Widget not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: widget
      });
    } catch (error) {
      console.error('Error fetching widget:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch widget',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const validatedData = updateWidgetSchema.parse(req.body) as UpdateWidgetRequest;
      const user = req.user!;

      const widget = await dashboardService.updateWidget(id, validatedData, user);
      
      if (!widget) {
        res.status(404).json({
          success: false,
          error: 'Widget not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: widget,
        message: 'Widget updated successfully'
      });
    } catch (error) {
      console.error('Error updating widget:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to update widget',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      const success = await dashboardService.deleteWidget(id, user);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Widget not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Widget deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting widget:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete widget',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Query endpoints
  async createQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = createQuerySchema.parse(req.body) as CreateQueryRequest;
      const user = req.user!;

      const query = await dashboardService.createQuery(validatedData, user);
      
      res.status(201).json({
        success: true,
        data: query,
        message: 'Query created successfully'
      });
    } catch (error) {
      console.error('Error creating query:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to create query',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getQueries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { includeTemplates } = req.query;
      const user = req.user!;

      const queries = await dashboardService.getQueries(user, includeTemplates === 'true');
      
      res.json({
        success: true,
        data: queries,
        count: queries.length
      });
    } catch (error) {
      console.error('Error fetching queries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch queries',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      const query = await dashboardService.getQuery(id, user);
      
      if (!query) {
        res.status(404).json({
          success: false,
          error: 'Query not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: query
      });
    } catch (error) {
      console.error('Error fetching query:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch query',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Widget data endpoint
  async getWidgetData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = widgetDataSchema.parse(req.body) as WidgetDataRequest;
      const user = req.user!;

      const result = await dashboardService.getWidgetData(validatedData, user);
      
      res.json({
        success: true,
        data: result.data,
        cached: result.cached,
        metadata: result.metadata
      });
    } catch (error) {
      console.error('Error fetching widget data:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to fetch widget data',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Export endpoints
  async createExportJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const validatedData = exportRequestSchema.parse(req.body) as ExportRequest;
      const user = req.user!;

      const exportJob = await dashboardService.createExportJob(validatedData, user);
      
      // Enqueue export job
      await dashboardJobService.enqueueDashboardExport(exportJob.id);
      
      res.status(201).json({
        success: true,
        data: exportJob,
        message: 'Export job created successfully'
      });
    } catch (error) {
      console.error('Error creating export job:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors
        });
        return;
      }
      res.status(500).json({
        success: false,
        error: 'Failed to create export job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportJob(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = req.user!;

      const exportJob = await dashboardService.getExportJob(id, user);
      
      if (!exportJob) {
        res.status(404).json({
          success: false,
          error: 'Export job not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        data: exportJob
      });
    } catch (error) {
      console.error('Error fetching export job:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportJobs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const user = req.user!;

      const exportJobs = await dashboardService.getExportJobsForDashboard(dashboardId, user);
      
      res.json({
        success: true,
        data: exportJobs,
        count: exportJobs.length
      });
    } catch (error) {
      console.error('Error fetching export jobs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch export jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Sharing endpoints
  async shareDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const { sharedWithUserId, sharedWithRole, permissionLevel } = req.body;
      const user = req.user!;

      const share = await dashboardService.shareDashboard(
        dashboardId,
        sharedWithUserId,
        sharedWithRole,
        permissionLevel,
        user
      );
      
      if (!share) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found or access denied'
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: share,
        message: 'Dashboard shared successfully'
      });
    } catch (error) {
      console.error('Error sharing dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to share dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async unshareDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId, userId } = req.params;
      const user = req.user!;

      const success = await dashboardService.unshareDashboard(dashboardId, userId, user);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found or access denied'
        });
        return;
      }

      res.json({
        success: true,
        message: 'Dashboard unshared successfully'
      });
    } catch (error) {
      console.error('Error unsharing dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to unshare dashboard',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const dashboardController = new DashboardController();
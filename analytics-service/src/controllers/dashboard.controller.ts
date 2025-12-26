import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { 
  Dashboard, 
  DashboardWidget,
  DashboardFilter,
  DataConnector,
  SavedQuery,
  NLSuggestion
} from '../types';
import { z } from 'zod';

// Validation schemas
const createDashboardSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['marketing', 'sales', 'finance', 'operations', 'custom']),
});

const updateDashboardSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  type: z.enum(['marketing', 'sales', 'finance', 'operations', 'custom']).optional(),
});

const createWidgetSchema = z.object({
  dashboardId: z.string().uuid(),
  queryId: z.string().uuid().optional(),
  type: z.enum(['chart', 'kpi', 'table', 'metric', 'gauge', 'stat']),
  title: z.string().optional(),
  description: z.string().optional(),
  chartType: z.enum(['line', 'bar', 'pie', 'area', 'scatter', 'map', 'heatmap']).optional(),
  config: z.record(z.any()).optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number()
  }).optional(),
});

const createDataConnectorSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['postgresql', 'mysql', 'bigquery', 'snowflake', 'redshift', 'api']),
  config: z.record(z.any()),
});

const createSavedQuerySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  queryText: z.string().min(1),
  queryType: z.enum(['kpi', 'custom', 'metric']).optional(),
  parameters: z.record(z.any()).optional(),
});

export class DashboardController {
  // ==================== Dashboards ====================

  async listDashboards(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const dashboards = await dashboardService.getDashboards(organizationId);
      
      res.json({
        success: true,
        data: dashboards,
        count: dashboards.length,
      });
    } catch (error) {
      console.error('Error listing dashboards:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list dashboards',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const dashboard = await dashboardService.getDashboardById(dashboardId);
      
      if (!dashboard) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found',
        });
        return;
      }

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error getting dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const body = createDashboardSchema.parse(req.body);
      
      const dashboard = await dashboardService.createDashboard({
        organizationId,
        ...body,
        createdBy: req.user?.email,
      });

      res.status(201).json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error creating dashboard:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create dashboard',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async updateDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const body = updateDashboardSchema.parse(req.body);
      
      const dashboard = await dashboardService.updateDashboard(dashboardId, body);

      res.json({
        success: true,
        data: dashboard,
      });
    } catch (error) {
      console.error('Error updating dashboard:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update dashboard',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async deleteDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const success = await dashboardService.deleteDashboard(dashboardId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Dashboard not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Dashboard deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== Dashboard Widgets ====================

  async addWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const body = createWidgetSchema.parse(req.body);
      
      const widget = await dashboardService.addWidget({
        dashboardId,
        ...body,
      });

      res.status(201).json({
        success: true,
        data: widget,
      });
    } catch (error) {
      console.error('Error adding widget:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to add widget',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async updateWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { widgetId } = req.params;
      const body = req.body;
      
      const widget = await dashboardService.updateWidget(widgetId, body);

      res.json({
        success: true,
        data: widget,
      });
    } catch (error) {
      console.error('Error updating widget:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update widget',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async removeWidget(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { widgetId } = req.params;
      const success = await dashboardService.removeWidget(widgetId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Widget not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Widget removed successfully',
      });
    } catch (error) {
      console.error('Error removing widget:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove widget',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== Dashboard Filters ====================

  async addFilter(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const body = req.body;
      
      const filter = await dashboardService.addDashboardFilter({
        dashboardId,
        ...body,
      });

      res.status(201).json({
        success: true,
        data: filter,
      });
    } catch (error) {
      console.error('Error adding filter:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to add filter',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async removeFilter(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { filterId } = req.params;
      const success = await dashboardService.removeDashboardFilter(filterId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Filter not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Filter removed successfully',
      });
    } catch (error) {
      console.error('Error removing filter:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to remove filter',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== Data Connectors ====================

  async listDataConnectors(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const connectors = await dashboardService.getDataConnectors(organizationId);
      
      res.json({
        success: true,
        data: connectors,
        count: connectors.length,
      });
    } catch (error) {
      console.error('Error listing data connectors:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list data connectors',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getDataConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { connectorId } = req.params;
      const connector = await dashboardService.getDataConnectorById(connectorId);
      
      if (!connector) {
        res.status(404).json({
          success: false,
          error: 'Data connector not found',
        });
        return;
      }

      res.json({
        success: true,
        data: connector,
      });
    } catch (error) {
      console.error('Error getting data connector:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get data connector',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createDataConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const body = createDataConnectorSchema.parse(req.body);
      
      const connector = await dashboardService.createDataConnector({
        organizationId,
        ...body,
      });

      res.status(201).json({
        success: true,
        data: connector,
      });
    } catch (error) {
      console.error('Error creating data connector:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create data connector',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  async updateDataConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { connectorId } = req.params;
      const body = req.body;
      
      const connector = await dashboardService.updateDataConnector(connectorId, body);

      res.json({
        success: true,
        data: connector,
      });
    } catch (error) {
      console.error('Error updating data connector:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update data connector',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteDataConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { connectorId } = req.params;
      const success = await dashboardService.deleteDataConnector(connectorId);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Data connector not found',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Data connector deleted successfully',
      });
    } catch (error) {
      console.error('Error deleting data connector:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete data connector',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async testDataConnector(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { connectorId } = req.params;
      const connector = await dashboardService.getDataConnectorById(connectorId);
      
      if (!connector) {
        res.status(404).json({
          success: false,
          error: 'Data connector not found',
        });
        return;
      }

      const testResult = await dashboardService.testDataConnector(connector);

      res.json({
        success: true,
        data: {
          connectorId,
          connected: testResult,
          message: testResult ? 'Connection successful' : 'Connection failed',
        },
      });
    } catch (error) {
      console.error('Error testing data connector:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to test data connector',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getConnectorSchema(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { connectorId } = req.params;
      const schema = await dashboardService.getConnectorSchema(connectorId);

      res.json({
        success: true,
        data: schema,
        count: schema.length,
      });
    } catch (error) {
      console.error('Error getting connector schema:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get connector schema',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== Saved Queries ====================

  async listSavedQueries(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const queries = await dashboardService.getSavedQueries(organizationId);
      
      res.json({
        success: true,
        data: queries,
        count: queries.length,
      });
    } catch (error) {
      console.error('Error listing saved queries:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to list saved queries',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async createSavedQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { organizationId } = req.params;
      const body = createSavedQuerySchema.parse(req.body);
      
      const query = await dashboardService.createSavedQuery({
        organizationId,
        ...body,
        createdBy: req.user?.email,
      });

      res.status(201).json({
        success: true,
        data: query,
      });
    } catch (error) {
      console.error('Error creating saved query:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: 'Validation error',
          details: error.errors,
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to create saved query',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  // ==================== Query Execution ====================

  async executeQuery(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { queryId } = req.params;
      const { parameters } = req.body;
      
      const query = await dashboardService.getSavedQueryById(queryId);
      if (!query) {
        res.status(404).json({
          success: false,
          error: 'Query not found',
        });
        return;
      }

      const result = await dashboardService.executeQuery(query, parameters);

      res.json({
        success: result.success,
        data: result,
      });
    } catch (error) {
      console.error('Error executing query:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute query',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== NL Suggestions ====================

  async getNLSuggestions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { connectorId } = req.params;
      const { prefix } = req.query;

      if (!prefix || typeof prefix !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Query prefix is required',
        });
        return;
      }

      const suggestions = await dashboardService.getNLSuggestions(connectorId, prefix);

      res.json({
        success: true,
        data: suggestions,
        count: suggestions.length,
      });
    } catch (error) {
      console.error('Error getting NL suggestions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get NL suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // ==================== Dashboard Exports ====================

  async exportDashboard(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { dashboardId } = req.params;
      const { format } = req.body;

      if (!format) {
        res.status(400).json({
          success: false,
          error: 'Export format is required',
        });
        return;
      }

      const export_ = await dashboardService.createDashboardExport(
        dashboardId,
        format,
        req.user?.email
      );

      res.status(201).json({
        success: true,
        data: export_,
      });
    } catch (error) {
      console.error('Error exporting dashboard:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getExportStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { exportId } = req.params;
      const export_ = await dashboardService.getDashboardExportStatus(exportId);

      if (!export_) {
        res.status(404).json({
          success: false,
          error: 'Export not found',
        });
        return;
      }

      res.json({
        success: true,
        data: export_,
      });
    } catch (error) {
      console.error('Error getting export status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get export status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const dashboardController = new DashboardController();

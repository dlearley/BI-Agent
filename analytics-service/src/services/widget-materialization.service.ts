import { db } from '../config/database';
import { redis } from '../config/redis';
import { queueService } from './queue.service';
import { 
  Widget, 
  WidgetQuery, 
  WidgetDataCache,
  ExportJob,
  ExportStatus,
  ExportType
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';
// Playwright will be imported dynamically to avoid build issues
let playwright: any;

async function getPlaywright() {
  if (!playwright) {
    playwright = await import('playwright');
  }
  return playwright;
}

export class WidgetMaterializationService {
  private readonly CACHE_TTL = 5 * 60; // 5 minutes
  private readonly MATERIALIZATION_INTERVAL = 60 * 1000; // 1 minute

  constructor() {
    this.startMaterializationScheduler();
  }

  // Background job to materialize widget queries and cache results
  async materializeWidgetData(widgetId: string): Promise<void> {
    try {
      console.log(`Starting materialization for widget: ${widgetId}`);

      // Get widget and query information
      const widget = await this.getWidget(widgetId);
      if (!widget) {
        console.error(`Widget not found: ${widgetId}`);
        return;
      }

      const query = await this.getQuery(widget.queryId);
      if (!query) {
        console.error(`Query not found for widget: ${widgetId}`);
        return;
      }

      // Generate query hash
      const queryHash = this.generateQueryHash(query.queryText);

      // Execute query and cache results
      const startTime = Date.now();
      let data: any;

      if (query.queryType === 'materialized_view' && query.materializedViewName) {
        data = await this.executeMaterializedViewQuery(query.materializedViewName);
      } else {
        data = await this.executeSQLQuery(query.queryText);
      }

      const executionTime = Date.now() - startTime;

      // Cache the result
      await this.cacheWidgetData(widgetId, queryHash, data, {
        executionTime,
        rowCount: Array.isArray(data) ? data.length : 1,
        materializedAt: new Date()
      });

      console.log(`Successfully materialized widget: ${widgetId} (${executionTime}ms)`);

    } catch (error) {
      console.error(`Error materializing widget ${widgetId}:`, error);
      throw error;
    }
  }

  // Batch materialization for all active widgets
  async materializeAllWidgets(): Promise<void> {
    try {
      console.log('Starting batch materialization of all widgets');

      // Get all widgets that need materialization
      const widgets = await this.getActiveWidgets();
      
      // Process widgets in parallel batches
      const batchSize = 10;
      for (let i = 0; i < widgets.length; i += batchSize) {
        const batch = widgets.slice(i, i + batchSize);
        
        await Promise.allSettled(
          batch.map(widget => this.materializeWidgetData(widget.id))
        );
      }

      console.log(`Completed batch materialization of ${widgets.length} widgets`);

    } catch (error) {
      console.error('Error in batch materialization:', error);
    }
  }

  // Export dashboard to PDF/PNG
  async exportDashboard(exportJobId: string): Promise<void> {
    try {
      console.log(`Starting export for job: ${exportJobId}`);

      // Get export job details
      const exportJob = await this.getExportJob(exportJobId);
      if (!exportJob) {
        console.error(`Export job not found: ${exportJobId}`);
        return;
      }

      // Update status to processing
      await this.updateExportJobStatus(exportJobId, ExportStatus.PROCESSING);

      // Get dashboard and widget data
      const dashboard = await this.getDashboard(exportJob.dashboardId);
      if (!dashboard) {
        throw new Error('Dashboard not found');
      }

      // Generate export
      const filePath = await this.generateExportFile(exportJob, dashboard);

      // Update job with file path
      await this.completeExportJob(exportJobId, filePath);

      console.log(`Successfully completed export: ${exportJobId} -> ${filePath}`);

    } catch (error) {
      console.error(`Error exporting dashboard ${exportJobId}:`, error);
      await this.failExportJob(exportJobId, error instanceof Error ? error.message : 'Unknown error');
    }
  }

  // Refresh materialized views
  async refreshMaterializedViews(): Promise<void> {
    try {
      console.log('Starting refresh of materialized views');

      // Get all materialized views used by widget queries
      const views = await this.getMaterializedViews();

      for (const view of views) {
        try {
          await this.refreshMaterializedView(view.materialized_view_name);
          console.log(`Refreshed materialized view: ${view.materialized_view_name}`);
        } catch (error) {
          console.error(`Error refreshing materialized view ${view.materialized_view_name}:`, error);
        }
      }

      console.log('Completed refresh of materialized views');

    } catch (error) {
      console.error('Error refreshing materialized views:', error);
    }
  }

  // Private helper methods
  private async startMaterializationScheduler(): Promise<void> {
    console.log('Starting widget materialization scheduler');

    // Schedule materialization every minute
    setInterval(async () => {
      try {
        await this.materializeAllWidgets();
      } catch (error) {
        console.error('Error in scheduled materialization:', error);
      }
    }, this.MATERIALIZATION_INTERVAL);

    // Schedule materialized view refresh every hour
    setInterval(async () => {
      try {
        await this.refreshMaterializedViews();
      } catch (error) {
        console.error('Error in scheduled view refresh:', error);
      }
    }, 60 * 60 * 1000);
  }

  private async getWidget(widgetId: string): Promise<Widget | null> {
    const sql = 'SELECT * FROM widgets WHERE id = $1';
    const result = await db.query(sql, [widgetId]);
    
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      name: row.name,
      type: row.type,
      queryId: row.query_id,
      config: JSON.parse(row.config),
      position: JSON.parse(row.position),
      drillThroughConfig: JSON.parse(row.drill_through_config),
      crossFilters: JSON.parse(row.cross_filters),
      refreshInterval: row.refresh_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by
    };
  }

  private async getQuery(queryId: string): Promise<WidgetQuery | null> {
    const sql = 'SELECT * FROM widget_queries WHERE id = $1';
    const result = await db.query(sql, [queryId]);
    
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      queryText: row.query_text,
      queryType: row.query_type,
      materializedViewName: row.materialized_view_name,
      parameters: JSON.parse(row.parameters),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      isTemplate: row.is_template
    };
  }

  private async getActiveWidgets(): Promise<Widget[]> {
    // Get widgets from published dashboards that have been updated recently
    const sql = `
      SELECT w.* FROM widgets w
      JOIN dashboards d ON w.dashboard_id = d.id
      WHERE d.status = 'published' 
        AND w.updated_at > NOW() - INTERVAL '1 hour'
      ORDER BY w.updated_at DESC
    `;

    const result = await db.query(sql);
    return result.map(row => this.mapRowToWidget(row));
  }

  private async getExportJob(exportJobId: string): Promise<ExportJob | null> {
    const sql = 'SELECT * FROM export_jobs WHERE id = $1';
    const result = await db.query(sql, [exportJobId]);
    
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      exportType: row.export_type,
      formatOptions: JSON.parse(row.format_options),
      status: row.status,
      filePath: row.file_path,
      fileSize: row.file_size,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdBy: row.created_by
    };
  }

  private async getDashboard(dashboardId: string): Promise<any> {
    const sql = 'SELECT * FROM dashboards WHERE id = $1';
    const result = await db.query(sql, [dashboardId]);
    
    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      layout: JSON.parse(row.layout),
      version: row.version,
      status: row.status,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      publishedAt: row.published_at,
      tags: JSON.parse(row.tags),
      isPublic: row.is_public,
      facilityId: row.facility_id
    };
  }

  private async getMaterializedViews(): Promise<any[]> {
    const sql = `
      SELECT DISTINCT materialized_view_name 
      FROM widget_queries 
      WHERE query_type = 'materialized_view' 
        AND materialized_view_name IS NOT NULL
    `;

    return await db.query(sql);
  }

  private async refreshMaterializedView(viewName: string): Promise<void> {
    const sql = `REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName}`;
    await db.query(sql);
  }

  private generateQueryHash(queryText: string): string {
    return crypto.createHash('sha256').update(queryText).digest('hex');
  }

  private async cacheWidgetData(
    widgetId: string, 
    queryHash: string, 
    data: any, 
    metadata: any
  ): Promise<void> {
    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.CACHE_TTL * 1000);

    const sql = `
      INSERT INTO widget_data_cache (
        id, widget_id, query_hash, data, metadata, created_at, expires_at, last_refreshed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (widget_id, query_hash) 
      DO UPDATE SET 
        data = EXCLUDED.data,
        metadata = EXCLUDED.metadata,
        expires_at = EXCLUDED.expires_at,
        refresh_count = widget_data_cache.refresh_count + 1,
        last_refreshed_at = EXCLUDED.last_refreshed_at
    `;

    const values = [
      id,
      widgetId,
      queryHash,
      JSON.stringify(data),
      JSON.stringify(metadata),
      now,
      expiresAt,
      now
    ];

    await db.query(sql, values);
  }

  private async executeSQLQuery(queryText: string): Promise<any> {
    const result = await db.query(queryText);
    return result;
  }

  private async executeMaterializedViewQuery(viewName: string): Promise<any> {
    const query = `SELECT * FROM ${viewName}`;
    const result = await db.query(query);
    return result;
  }

  private async generateExportFile(exportJob: ExportJob, dashboard: any): Promise<string> {
    const formatOptions = exportJob.formatOptions || {};
    const fileName = `dashboard_${dashboard.id}_${Date.now()}.${exportJob.exportType}`;
    const filePath = `/tmp/exports/${fileName}`;

    // Create a simple HTML representation of the dashboard
    const html = this.generateDashboardHTML(dashboard, formatOptions);

    // Launch browser and generate export
    const pw = await getPlaywright();
    const browser = await pw.chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html);

      if (exportJob.exportType === ExportType.PDF) {
        await page.pdf({
          path: filePath,
          format: formatOptions.paperSize || 'A4',
          landscape: formatOptions.orientation === 'landscape',
          margin: formatOptions.margin || {
            top: '1cm',
            right: '1cm',
            bottom: '1cm',
            left: '1cm'
          },
          scale: formatOptions.scale || 1.0
        });
      } else if (exportJob.exportType === ExportType.PNG) {
        const dimensions = this.getDashboardDimensions(dashboard);
        await page.screenshot({
          path: filePath,
          fullPage: true,
          quality: formatOptions.quality || 80
        });
      }

      return filePath;

    } finally {
      await browser.close();
    }
  }

  private generateDashboardHTML(dashboard: any, formatOptions: any): string {
    const includeTimestamp = formatOptions.includeTimestamp !== false;
    const customHeader = formatOptions.customHeader || '';
    const customFooter = formatOptions.customFooter || '';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${dashboard.name}</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            line-height: 1.4;
          }
          .header { 
            border-bottom: 2px solid #333; 
            padding-bottom: 10px; 
            margin-bottom: 20px; 
          }
          .footer { 
            border-top: 2px solid #333; 
            padding-top: 10px; 
            margin-top: 20px; 
            font-size: 12px; 
            color: #666;
          }
          .dashboard-title { 
            font-size: 24px; 
            font-weight: bold; 
            margin: 0;
          }
          .dashboard-description { 
            color: #666; 
            margin: 5px 0;
          }
          .timestamp { 
            font-size: 14px; 
            color: #999;
          }
          .widget { 
            border: 1px solid #ddd; 
            margin: 10px 0; 
            padding: 15px;
            border-radius: 4px;
          }
          .widget-title { 
            font-weight: bold; 
            margin-bottom: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          ${customHeader ? `<div>${customHeader}</div>` : ''}
          <h1 class="dashboard-title">${dashboard.name}</h1>
          ${dashboard.description ? `<div class="dashboard-description">${dashboard.description}</div>` : ''}
          ${includeTimestamp ? `<div class="timestamp">Generated: ${new Date().toLocaleString()}</div>` : ''}
        </div>

        <div class="content">
          <p><em>Dashboard content would be rendered here with actual widget data.</em></p>
          ${dashboard.tags && dashboard.tags.length > 0 ? 
            `<div>Tags: ${dashboard.tags.join(', ')}</div>` : ''
          }
        </div>

        <div class="footer">
          ${customFooter ? `<div>${customFooter}</div>` : ''}
          <div>Generated by BI-Agent Analytics Platform</div>
        </div>
      </body>
      </html>
    `;
  }

  private getDashboardDimensions(dashboard: any): { width: number; height: number } {
    // Default dimensions - in a real implementation, this would be calculated
    // based on the dashboard layout
    return { width: 1200, height: 800 };
  }

  private async updateExportJobStatus(jobId: string, status: ExportStatus): Promise<void> {
    const sql = `
      UPDATE export_jobs 
      SET status = $1, started_at = CURRENT_TIMESTAMP
      WHERE id = $2
    `;
    await db.query(sql, [status, jobId]);
  }

  private async completeExportJob(jobId: string, filePath: string): Promise<void> {
    // Get file size
    const fs = require('fs').promises;
    const stats = await fs.stat(filePath);

    const sql = `
      UPDATE export_jobs 
      SET status = $1, file_path = $2, file_size = $3, completed_at = CURRENT_TIMESTAMP
      WHERE id = $4
    `;
    await db.query(sql, [ExportStatus.COMPLETED, filePath, stats.size, jobId]);
  }

  private async failExportJob(jobId: string, errorMessage: string): Promise<void> {
    const sql = `
      UPDATE export_jobs 
      SET status = $1, error_message = $2, completed_at = CURRENT_TIMESTAMP
      WHERE id = $3
    `;
    await db.query(sql, [ExportStatus.FAILED, errorMessage, jobId]);
  }

  private mapRowToWidget(row: any): Widget {
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      name: row.name,
      type: row.type,
      queryId: row.query_id,
      config: JSON.parse(row.config),
      position: JSON.parse(row.position),
      drillThroughConfig: JSON.parse(row.drill_through_config),
      crossFilters: JSON.parse(row.cross_filters),
      refreshInterval: row.refresh_interval,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by
    };
  }
}

export const widgetMaterializationService = new WidgetMaterializationService();
import { queueService } from './queue.service';
import { widgetMaterializationService } from './widget-materialization.service';
import { JobData, JobResult } from '../types';

export class DashboardJobService {
  constructor() {
    this.setupJobProcessors();
  }

  private setupJobProcessors(): void {
    // Process widget materialization jobs
    queueService.process('materialize_widget', async (job) => {
      const { widgetId } = job.data as { widgetId: string };
      
      try {
        await widgetMaterializationService.materializeWidgetData(widgetId);
        
        return {
          success: true,
          message: `Successfully materialized widget: ${widgetId}`,
          data: { widgetId }
        } as JobResult;
      } catch (error) {
        return {
          success: false,
          message: `Failed to materialize widget: ${widgetId}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        } as JobResult;
      }
    });

    // Process export jobs
    queueService.process('export_dashboard', async (job) => {
      const { exportJobId } = job.data as { exportJobId: string };
      
      try {
        await widgetMaterializationService.exportDashboard(exportJobId);
        
        return {
          success: true,
          message: `Successfully exported dashboard: ${exportJobId}`,
          data: { exportJobId }
        } as JobResult;
      } catch (error) {
        return {
          success: false,
          message: `Failed to export dashboard: ${exportJobId}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        } as JobResult;
      }
    });

    // Process batch materialization jobs
    queueService.process('materialize_all_widgets', async (job) => {
      try {
        await widgetMaterializationService.materializeAllWidgets();
        
        return {
          success: true,
          message: 'Successfully materialized all widgets',
          data: {}
        } as JobResult;
      } catch (error) {
        return {
          success: false,
          message: 'Failed to materialize widgets',
          error: error instanceof Error ? error.message : 'Unknown error'
        } as JobResult;
      }
    });

    // Process materialized view refresh jobs
    queueService.process('refresh_materialized_views', async (job) => {
      try {
        await widgetMaterializationService.refreshMaterializedViews();
        
        return {
          success: true,
          message: 'Successfully refreshed materialized views',
          data: {}
        } as JobResult;
      } catch (error) {
        return {
          success: false,
          message: 'Failed to refresh materialized views',
          error: error instanceof Error ? error.message : 'Unknown error'
        } as JobResult;
      }
    });
  }

  // Helper methods to enqueue jobs
  async enqueueWidgetMaterialization(widgetId: string, delay: number = 0): Promise<void> {
    await queueService.enqueueJob({
      type: 'materialize_widget',
      data: { widgetId },
      opts: { delay }
    });
  }

  async enqueueDashboardExport(exportJobId: string, delay: number = 0): Promise<void> {
    await queueService.enqueueJob({
      type: 'export_dashboard',
      data: { exportJobId },
      opts: { delay }
    });
  }

  async enqueueBatchMaterialization(delay: number = 0): Promise<void> {
    await queueService.enqueueJob({
      type: 'materialize_all_widgets',
      data: {},
      opts: { delay }
    });
  }

  async enqueueMaterializedViewRefresh(delay: number = 0): Promise<void> {
    await queueService.enqueueJob({
      type: 'refresh_materialized_views',
      data: {},
      opts: { delay }
    });
  }
}

export const dashboardJobService = new DashboardJobService();
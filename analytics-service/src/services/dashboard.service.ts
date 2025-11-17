import { db } from '../config/database';
import { redis } from '../config/redis';
import { kafkaService } from './kafka.service';
import { 
  SavedView, 
  DashboardType, 
  DashboardFilters, 
  DashboardLayout,
  DashboardQuery,
  DashboardResponse,
  DrilldownConfig,
  ExportJob,
  ExportStatus,
  User,
  TimeRange
} from '../types';
import config from '../config';
import { applyRowLevelSecurity, applyColumnLevelSecurity } from '../middleware/rbac';

export class DashboardService {
  private readonly cachePrefix = 'dashboard:';
  private readonly defaultCacheTTL = config.analytics.cacheTTL;

  private generateCacheKey(type: string, query: DashboardQuery, user: User): string {
    const key = `${this.cachePrefix}${type}:${user.id}:${JSON.stringify(query)}`;
    return key.replace(/[^a-zA-Z0-9:_-]/g, '_');
  }

  private resolveTimeRange(timeRange?: TimeRange): { startDate?: string; endDate?: string } {
    if (!timeRange) return {};

    const now = new Date();
    
    if (timeRange.preset) {
      switch (timeRange.preset) {
        case 'today':
          return {
            startDate: now.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          return { startDate: yesterdayStr, endDate: yesterdayStr };
        case 'last7days':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return {
            startDate: weekAgo.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'last30days':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          return {
            startDate: monthAgo.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'last90days':
          const quarterAgo = new Date(now);
          quarterAgo.setDate(quarterAgo.getDate() - 90);
          return {
            startDate: quarterAgo.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'thismonth':
          const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return {
            startDate: firstOfMonth.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'lastmonth':
          const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          return {
            startDate: firstOfLastMonth.toISOString().split('T')[0],
            endDate: lastOfLastMonth.toISOString().split('T')[0],
          };
        case 'thisyear':
          const firstOfYear = new Date(now.getFullYear(), 0, 1);
          return {
            startDate: firstOfYear.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        default:
          return {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          };
      }
    }

    return {
      startDate: timeRange.startDate,
      endDate: timeRange.endDate,
    };
  }

  async getDashboardData(query: DashboardQuery, user: User): Promise<DashboardResponse> {
    const cacheKey = this.generateCacheKey('data', query, user);
    
    // Try cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const timeRange = this.resolveTimeRange(query.timeRange);
      const dashboardType = query.dashboardType || DashboardType.COMBINED;
      
      let data: any;
      let recordCount = 0;

      switch (dashboardType) {
        case DashboardType.PIPELINE:
          data = await this.getPipelineDashboardData(query, user, timeRange);
          recordCount = data.length;
          break;
        case DashboardType.REVENUE:
          data = await this.getRevenueDashboardData(query, user, timeRange);
          recordCount = data.length;
          break;
        case DashboardType.COMPLIANCE:
          data = await this.getComplianceDashboardData(query, user, timeRange);
          recordCount = data.length;
          break;
        case DashboardType.OUTREACH:
          data = await this.getOutreachDashboardData(query, user, timeRange);
          recordCount = data.length;
          break;
        case DashboardType.COMBINED:
          data = await this.getCombinedDashboardData(query, user, timeRange);
          recordCount = Array.isArray(data) ? data.length : Object.keys(data).length;
          break;
        default:
          throw new Error(`Unsupported dashboard type: ${dashboardType}`);
      }

      const response: DashboardResponse = {
        success: true,
        data,
        metadata: {
          viewId: query.viewId,
          dashboardType,
          filters: {
            ...query,
            ...timeRange,
          },
          timestamp: new Date().toISOString(),
          recordCount,
          cached: false,
          hasDrilldowns: query.includeDrilldowns || false,
        },
      };

      // Cache the response
      await redis.set(cacheKey, response, this.defaultCacheTTL);

      return response;
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      throw error;
    }
  }

  private async getPipelineDashboardData(query: DashboardQuery, user: User, timeRange: { startDate?: string; endDate?: string }): Promise<any> {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        SUM(total_applications) as total_applications,
        SUM(hired_count) as hired_count,
        SUM(rejected_count) as rejected_count,
        SUM(pending_count) as pending_count,
        SUM(interview_count) as interview_count,
        ROUND(AVG(avg_time_to_fill_days), 2) as avg_time_to_fill_days,
        month
      FROM analytics.pipeline_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    // Apply row-level security
    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` GROUP BY facility_id, facility_name, month ORDER BY month DESC, facility_id`;

    const result = await db.query(sql, params);
    return result;
  }

  private async getRevenueDashboardData(query: DashboardQuery, user: User, timeRange: { startDate?: string; endDate?: string }): Promise<any> {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        SUM(total_revenue) as total_revenue,
        ROUND(AVG(avg_revenue_per_invoice), 2) as avg_revenue_per_invoice,
        month
      FROM analytics.revenue_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    // Apply row-level security
    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` GROUP BY facility_id, facility_name, month ORDER BY month DESC, facility_id`;

    const result = await db.query(sql, params);
    return result;
  }

  private async getComplianceDashboardData(query: DashboardQuery, user: User, timeRange: { startDate?: string; endDate?: string }): Promise<any> {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        SUM(total_applications) as total_applications,
        SUM(compliant_applications) as compliant_applications,
        ROUND(AVG(compliance_rate), 2) as compliance_rate,
        SUM(violation_count) as violation_count,
        month
      FROM analytics.compliance_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    // Apply row-level security
    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` GROUP BY facility_id, facility_name, month ORDER BY month DESC, facility_id`;

    const result = await db.query(sql, params);
    return result;
  }

  private async getOutreachDashboardData(query: DashboardQuery, user: User, timeRange: { startDate?: string; endDate?: string }): Promise<any> {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        SUM(total_outreach) as total_outreach,
        ROUND(AVG(response_rate), 2) as avg_response_rate,
        ROUND(AVG(conversion_rate), 2) as avg_conversion_rate,
        month
      FROM analytics.outreach_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    // Apply row-level security
    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` GROUP BY facility_id, facility_name, month ORDER BY month DESC, facility_id`;

    const result = await db.query(sql, params);
    return result;
  }

  private async getCombinedDashboardData(query: DashboardQuery, user: User, timeRange: { startDate?: string; endDate?: string }): Promise<any> {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        SUM(total_applications) as total_applications,
        SUM(hired_count) as hired_count,
        ROUND(AVG(avg_time_to_fill_days), 2) as avg_time_to_fill_days,
        SUM(compliant_applications) as compliant_applications,
        ROUND(AVG(compliance_rate), 2) as compliance_rate,
        SUM(violation_count) as violation_count,
        SUM(total_revenue) as total_revenue,
        ROUND(AVG(avg_revenue_per_invoice), 2) as avg_revenue_per_invoice,
        SUM(total_outreach) as total_outreach,
        ROUND(AVG(avg_response_rate), 2) as avg_response_rate,
        ROUND(AVG(avg_conversion_rate), 2) as avg_conversion_rate,
        month
      FROM analytics.combined_kpis
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    // Apply row-level security
    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` GROUP BY facility_id, facility_name, month ORDER BY month DESC, facility_id`;

    const result = await db.query(sql, params);
    return result;
  }

  async createSavedView(savedView: Omit<SavedView, 'id' | 'createdAt' | 'updatedAt'>, user: User): Promise<SavedView> {
    try {
      const query = `
        INSERT INTO saved_views (user_id, name, description, dashboard_type, filters, layout, is_public, is_default)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
      `;

      const result = await db.query(query, [
        user.id,
        savedView.name,
        savedView.description,
        savedView.dashboardType,
        JSON.stringify(savedView.filters),
        JSON.stringify(savedView.layout),
        savedView.isPublic,
        savedView.isDefault,
      ]);

      const createdView = result[0];

      // Invalidate cache for this user's dashboard views
      await kafkaService.invalidateCacheByPattern(
        `${this.cachePrefix}views:${user.id}:*`,
        'Saved view created',
        user.id
      );

      return createdView;
    } catch (error) {
      console.error('Error creating saved view:', error);
      throw error;
    }
  }

  async getSavedViews(user: User, dashboardType?: DashboardType): Promise<SavedView[]> {
    try {
      let sql = `
        SELECT * FROM saved_views 
        WHERE user_id = $1 OR is_public = true
      `;
      const params = [user.id];

      if (dashboardType) {
        sql += ` AND dashboard_type = $2`;
        params.push(dashboardType);
      }

      sql += ` ORDER BY is_default DESC, created_at DESC`;

      const result = await db.query(sql, params);
      return result;
    } catch (error) {
      console.error('Error fetching saved views:', error);
      throw error;
    }
  }

  async updateSavedView(id: string, updates: Partial<SavedView>, user: User): Promise<SavedView> {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${paramIndex++}`);
        values.push(updates.name);
      }
      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex++}`);
        values.push(updates.description);
      }
      if (updates.filters !== undefined) {
        fields.push(`filters = $${paramIndex++}`);
        values.push(JSON.stringify(updates.filters));
      }
      if (updates.layout !== undefined) {
        fields.push(`layout = $${paramIndex++}`);
        values.push(JSON.stringify(updates.layout));
      }
      if (updates.isPublic !== undefined) {
        fields.push(`is_public = $${paramIndex++}`);
        values.push(updates.isPublic);
      }
      if (updates.isDefault !== undefined) {
        fields.push(`is_default = $${paramIndex++}`);
        values.push(updates.isDefault);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(id, user.id);

      const query = `
        UPDATE saved_views 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.length === 0) {
        throw new Error('Saved view not found or access denied');
      }

      // Invalidate cache
      await kafkaService.invalidateCacheByPattern(
        `${this.cachePrefix}views:${user.id}:*`,
        'Saved view updated',
        user.id
      );

      return result[0];
    } catch (error) {
      console.error('Error updating saved view:', error);
      throw error;
    }
  }

  async deleteSavedView(id: string, user: User): Promise<void> {
    try {
      const query = `
        DELETE FROM saved_views 
        WHERE id = $1 AND user_id = $2
      `;

      await db.query(query, [id, user.id]);

      // Invalidate cache
      await kafkaService.invalidateCacheByPattern(
        `${this.cachePrefix}views:${user.id}:*`,
        'Saved view deleted',
        user.id
      );
    } catch (error) {
      console.error('Error deleting saved view:', error);
      throw error;
    }
  }

  async createDrilldownConfig(drilldownConfig: Omit<DrilldownConfig, 'id' | 'createdAt' | 'updatedAt'>, user: User): Promise<DrilldownConfig> {
    try {
      const query = `
        INSERT INTO drilldown_configs (user_id, view_id, metric_name, drilldown_path, target_table, filters)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;

      const result = await db.query(query, [
        user.id,
        drilldownConfig.viewId,
        drilldownConfig.metricName,
        JSON.stringify(drilldownConfig.drilldownPath),
        drilldownConfig.targetTable,
        JSON.stringify(drilldownConfig.filters),
      ]);

      return result[0];
    } catch (error) {
      console.error('Error creating drilldown config:', error);
      throw error;
    }
  }

  async getDrilldownConfigs(user: User, viewId?: string): Promise<DrilldownConfig[]> {
    try {
      let sql = `SELECT * FROM drilldown_configs WHERE user_id = $1`;
      const params = [user.id];

      if (viewId) {
        sql += ` AND view_id = $2`;
        params.push(viewId);
      }

      sql += ` ORDER BY created_at DESC`;

      const result = await db.query(sql, params);
      return result;
    } catch (error) {
      console.error('Error fetching drilldown configs:', error);
      throw error;
    }
  }

  async createExportJob(queryConfig: Record<string, any>, user: User): Promise<ExportJob> {
    try {
      const query = `
        INSERT INTO export_jobs (user_id, query_config, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `;

      const result = await db.query(query, [
        user.id,
        JSON.stringify(queryConfig),
        ExportStatus.PENDING,
      ]);

      return result[0];
    } catch (error) {
      console.error('Error creating export job:', error);
      throw error;
    }
  }

  async getExportJob(jobId: string, user: User): Promise<ExportJob | null> {
    try {
      const query = `
        SELECT * FROM export_jobs 
        WHERE id = $1 AND user_id = $2
      `;

      const result = await db.query(query, [jobId, user.id]);
      return result.length > 0 ? result[0] : null;
    } catch (error) {
      console.error('Error fetching export job:', error);
      throw error;
    }
  }

  async getExportJobs(user: User, status?: ExportStatus): Promise<ExportJob[]> {
    try {
      let sql = `SELECT * FROM export_jobs WHERE user_id = $1`;
      const params = [user.id];

      if (status) {
        sql += ` AND status = $2`;
        params.push(status);
      }

      sql += ` ORDER BY created_at DESC`;

      const result = await db.query(sql, params);
      return result;
    } catch (error) {
      console.error('Error fetching export jobs:', error);
      throw error;
    }
  }

  async updateExportJob(jobId: string, updates: Partial<ExportJob>, user: User): Promise<ExportJob> {
    try {
      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.status !== undefined) {
        fields.push(`status = $${paramIndex++}`);
        values.push(updates.status);
      }
      if (updates.filePath !== undefined) {
        fields.push(`file_path = $${paramIndex++}`);
        values.push(updates.filePath);
      }
      if (updates.recordCount !== undefined) {
        fields.push(`record_count = $${paramIndex++}`);
        values.push(updates.recordCount);
      }
      if (updates.fileSize !== undefined) {
        fields.push(`file_size = $${paramIndex++}`);
        values.push(updates.fileSize);
      }
      if (updates.errorMessage !== undefined) {
        fields.push(`error_message = $${paramIndex++}`);
        values.push(updates.errorMessage);
      }
      if (updates.startedAt !== undefined) {
        fields.push(`started_at = $${paramIndex++}`);
        values.push(updates.startedAt);
      }
      if (updates.completedAt !== undefined) {
        fields.push(`completed_at = $${paramIndex++}`);
        values.push(updates.completedAt);
      }

      if (fields.length === 0) {
        throw new Error('No fields to update');
      }

      values.push(jobId, user.id);

      const query = `
        UPDATE export_jobs 
        SET ${fields.join(', ')}
        WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
        RETURNING *
      `;

      const result = await db.query(query, values);
      
      if (result.length === 0) {
        throw new Error('Export job not found or access denied');
      }

      // Publish notification if status changed
      if (updates.status) {
        await kafkaService.publishExportNotification({
          jobId,
          userId: user.id,
          status: updates.status,
          filePath: result[0].filePath,
          recordCount: result[0].recordCount,
          errorMessage: result[0].errorMessage,
          timestamp: new Date().toISOString(),
        });
      }

      return result[0];
    } catch (error) {
      console.error('Error updating export job:', error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
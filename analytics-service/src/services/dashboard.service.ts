import { db } from '../config/database';
import { redis } from '../config/redis';
import { 
  Dashboard, 
  Widget, 
  WidgetQuery, 
  WidgetDataCache,
  DashboardVersion,
  DashboardShare,
  ExportJob,
  CreateDashboardRequest,
  UpdateDashboardRequest,
  CreateWidgetRequest,
  UpdateWidgetRequest,
  CreateQueryRequest,
  DashboardQueryOptions,
  WidgetDataRequest,
  ExportRequest,
  DashboardStatus,
  WidgetType,
  ExportType,
  ExportStatus,
  User,
  WidgetPosition,
  DashboardLayout,
  WidgetConfig,
  DrillThroughConfig,
  CrossFilter,
  QueryParameter,
  ExportFormatOptions
} from '../types';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export class DashboardService {
  // Dashboard CRUD operations
  async createDashboard(request: CreateDashboardRequest, user: User): Promise<Dashboard> {
    const id = uuidv4();
    const now = new Date();
    
    const defaultLayout: DashboardLayout = {
      grid: { cols: 12, rows: 20, gap: 1 },
      widgets: []
    };

    const sql = `
      INSERT INTO dashboards (
        id, name, description, layout, version, status, 
        created_by, created_at, updated_at, tags, is_public, facility_id
      ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      request.name,
      request.description || null,
      JSON.stringify(request.layout || defaultLayout),
      DashboardStatus.DRAFT,
      user.id,
      now,
      now,
      JSON.stringify(request.tags || []),
      request.isPublic || false,
      user.facilityId || null
    ];

    const result = await db.query(sql, values);
    return this.mapRowToDashboard(result[0]);
  }

  async getDashboard(id: string, user: User, options: DashboardQueryOptions = {}): Promise<Dashboard | null> {
    // Check permissions first
    const hasAccess = await this.checkDashboardAccess(id, user);
    if (!hasAccess) {
      return null;
    }

    const sql = `
      SELECT * FROM dashboards 
      WHERE id = $1 AND ($2::text IS NULL OR facility_id = $2 OR is_public = true)
    `;

    const result = await db.query(sql, [id, user.facilityId]);
    
    if (result.length === 0) {
      return null;
    }

    const dashboard = this.mapRowToDashboard(result[0]);

    // Include related data if requested
    if (options.includeWidgets) {
      dashboard.widgets = await this.getDashboardWidgets(id);
    }

    if (options.includeVersions) {
      dashboard.versions = await this.getDashboardVersions(id);
    }

    if (options.includeShares) {
      dashboard.shares = await this.getDashboardShares(id);
    }

    return dashboard;
  }

  async getDashboards(user: User, options: DashboardQueryOptions = {}): Promise<Dashboard[]> {
    let whereClause = 'WHERE ($1::text IS NULL OR facility_id = $1 OR is_public = true)';
    const values: any[] = [user.facilityId];
    let paramIndex = 2;

    if (options.status) {
      whereClause += ` AND status = $${paramIndex++}`;
      values.push(options.status);
    }

    if (options.createdBy) {
      whereClause += ` AND created_by = $${paramIndex++}`;
      values.push(options.createdBy);
    }

    if (options.tags && options.tags.length > 0) {
      whereClause += ` AND tags && $${paramIndex++}`;
      values.push(options.tags);
    }

    const sql = `
      SELECT * FROM dashboards 
      ${whereClause}
      ORDER BY updated_at DESC
    `;

    const result = await db.query(sql, values);
    
    const dashboards = result.map(row => this.mapRowToDashboard(row));

    // Include related data if requested
    if (options.includeWidgets) {
      for (const dashboard of dashboards) {
        dashboard.widgets = await this.getDashboardWidgets(dashboard.id);
      }
    }

    return dashboards;
  }

  async updateDashboard(id: string, request: UpdateDashboardRequest, user: User): Promise<Dashboard | null> {
    // Check if user has permission to update
    const hasAccess = await this.checkDashboardEditAccess(id, user);
    if (!hasAccess) {
      return null;
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }

    if (request.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(request.description);
    }

    if (request.layout !== undefined) {
      updates.push(`layout = $${paramIndex++}`);
      values.push(JSON.stringify(request.layout));
    }

    if (request.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(JSON.stringify(request.tags));
    }

    if (request.isPublic !== undefined) {
      updates.push(`is_public = $${paramIndex++}`);
      values.push(request.isPublic);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      return this.getDashboard(id, user);
    }

    const sql = `
      UPDATE dashboards 
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex++}
      RETURNING *
    `;

    values.push(id);

    const result = await db.query(sql, values);
    
    if (result.length === 0) {
      return null;
    }

    return this.mapRowToDashboard(result[0]);
  }

  async deleteDashboard(id: string, user: User): Promise<boolean> {
    // Check if user has permission to delete
    const hasAccess = await this.checkDashboardEditAccess(id, user);
    if (!hasAccess) {
      return false;
    }

    const sql = 'DELETE FROM dashboards WHERE id = $1';
    const result = await db.query(sql, [id]);
    
    return result.rowCount > 0;
  }

  async publishDashboard(id: string, user: User): Promise<Dashboard | null> {
    const hasAccess = await this.checkDashboardEditAccess(id, user);
    if (!hasAccess) {
      return null;
    }

    // Create a version before publishing
    await this.createDashboardVersion(id, user, 'Published version');

    const sql = `
      UPDATE dashboards 
      SET status = $1, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(sql, [DashboardStatus.PUBLISHED, id]);
    
    if (result.length === 0) {
      return null;
    }

    return this.mapRowToDashboard(result[0]);
  }

  // Widget CRUD operations
  async createWidget(request: CreateWidgetRequest, user: User): Promise<Widget> {
    const id = uuidv4();
    const now = new Date();

    const sql = `
      INSERT INTO widgets (
        id, dashboard_id, name, type, query_id, config, position,
        drill_through_config, cross_filters, refresh_interval, created_at, updated_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *
    `;

    const values = [
      id,
      request.dashboardId,
      request.name,
      request.type,
      request.queryId,
      JSON.stringify(request.config),
      JSON.stringify(request.position),
      JSON.stringify(request.drillThroughConfig || {}),
      JSON.stringify(request.crossFilters || []),
      request.refreshInterval || 300,
      now,
      now,
      user.id
    ];

    const result = await db.query(sql, values);
    return this.mapRowToWidget(result[0]);
  }

  async getWidget(id: string, user: User): Promise<Widget | null> {
    const sql = `
      SELECT w.* FROM widgets w
      JOIN dashboards d ON w.dashboard_id = d.id
      WHERE w.id = $1 AND ($2::text IS NULL OR d.facility_id = $2 OR d.is_public = true)
    `;

    const result = await db.query(sql, [id, user.facilityId]);
    
    if (result.length === 0) {
      return null;
    }

    return this.mapRowToWidget(result[0]);
  }

  async updateWidget(id: string, request: UpdateWidgetRequest, user: User): Promise<Widget | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (request.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(request.name);
    }

    if (request.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(request.config));
    }

    if (request.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(JSON.stringify(request.position));
    }

    if (request.drillThroughConfig !== undefined) {
      updates.push(`drill_through_config = $${paramIndex++}`);
      values.push(JSON.stringify(request.drillThroughConfig));
    }

    if (request.crossFilters !== undefined) {
      updates.push(`cross_filters = $${paramIndex++}`);
      values.push(JSON.stringify(request.crossFilters));
    }

    if (request.refreshInterval !== undefined) {
      updates.push(`refresh_interval = $${paramIndex++}`);
      values.push(request.refreshInterval);
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    if (updates.length === 0) {
      return this.getWidget(id, user);
    }

    const sql = `
      UPDATE widgets w
      SET ${updates.join(', ')}
      FROM dashboards d
      WHERE w.id = $${paramIndex++} AND w.dashboard_id = d.id 
        AND ($${paramIndex++}::text IS NULL OR d.facility_id = $${paramIndex++} OR d.is_public = true)
      RETURNING w.*
    `;

    values.push(id, user.facilityId, user.facilityId);

    const result = await db.query(sql, values);
    
    if (result.length === 0) {
      return null;
    }

    return this.mapRowToWidget(result[0]);
  }

  async deleteWidget(id: string, user: User): Promise<boolean> {
    const sql = `
      DELETE FROM widgets w
      USING dashboards d
      WHERE w.id = $1 AND w.dashboard_id = d.id 
        AND ($2::text IS NULL OR d.facility_id = $2 OR d.is_public = true)
    `;

    const result = await db.query(sql, [id, user.facilityId]);
    
    return result.rowCount > 0;
  }

  // Query operations
  async createQuery(request: CreateQueryRequest, user: User): Promise<WidgetQuery> {
    const id = uuidv4();
    const now = new Date();

    const sql = `
      INSERT INTO widget_queries (
        id, name, description, query_text, query_type, materialized_view_name,
        parameters, created_at, updated_at, created_by, is_template
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      request.name,
      request.description || null,
      request.queryText,
      request.queryType || 'sql',
      request.materializedViewName || null,
      JSON.stringify(request.parameters || []),
      now,
      now,
      user.id,
      request.isTemplate || false
    ];

    const result = await db.query(sql, values);
    return this.mapRowToQuery(result[0]);
  }

  async getQueries(user: User, includeTemplates: boolean = false): Promise<WidgetQuery[]> {
    let whereClause = 'WHERE created_by = $1';
    const values = [user.id];

    if (includeTemplates) {
      whereClause += ' OR is_template = true';
    }

    const sql = `
      SELECT * FROM widget_queries 
      ${whereClause}
      ORDER BY updated_at DESC
    `;

    const result = await db.query(sql, values);
    return result.map(row => this.mapRowToQuery(row));
  }

  async getQuery(id: string, user: User): Promise<WidgetQuery | null> {
    const sql = `
      SELECT * FROM widget_queries 
      WHERE id = $1 AND (created_by = $2 OR is_template = true)
    `;

    const result = await db.query(sql, [id, user.id]);
    
    if (result.length === 0) {
      return null;
    }

    return this.mapRowToQuery(result[0]);
  }

  // Widget data operations
  async getWidgetData(request: WidgetDataRequest, user: User): Promise<any> {
    const widget = await this.getWidget(request.widgetId, user);
    if (!widget) {
      throw new Error('Widget not found or access denied');
    }

    const query = await this.getQuery(widget.queryId, user);
    if (!query) {
      throw new Error('Query not found or access denied');
    }

    // Generate cache key
    const queryHash = this.generateQueryHash(query.queryText, request.parameters);
    const cacheKey = `widget_data:${widget.id}:${queryHash}`;

    // Try to get from cache if not forcing refresh
    if (!request.forceRefresh && request.useCache !== false) {
      const cachedData = await this.getCachedWidgetData(widget.id, queryHash);
      if (cachedData && new Date(cachedData.expiresAt) > new Date()) {
        return {
          data: cachedData.data,
          cached: true,
          metadata: cachedData.metadata
        };
      }
    }

    // Execute query
    const startTime = Date.now();
    let data: any;

    if (query.queryType === 'materialized_view' && query.materializedViewName) {
      data = await this.executeMaterializedViewQuery(query.materializedViewName, request.parameters);
    } else {
      data = await this.executeSQLQuery(query.queryText, request.parameters);
    }

    const executionTime = Date.now() - startTime;

    // Cache the result
    await this.cacheWidgetData(widget.id, queryHash, data, {
      executionTime,
      rowCount: Array.isArray(data) ? data.length : 1
    });

    return {
      data,
      cached: false,
      metadata: {
        executionTime,
        rowCount: Array.isArray(data) ? data.length : 1,
        lastUpdated: new Date()
      }
    };
  }

  // Dashboard sharing
  async shareDashboard(
    dashboardId: string, 
    sharedWithUserId: string | null, 
    sharedWithRole: string | null,
    permissionLevel: 'view' | 'edit' | 'admin',
    user: User
  ): Promise<DashboardShare | null> {
    const hasAccess = await this.checkDashboardEditAccess(dashboardId, user);
    if (!hasAccess) {
      return null;
    }

    const id = uuidv4();
    const now = new Date();

    const sql = `
      INSERT INTO dashboard_shares (
        id, dashboard_id, shared_with_user_id, shared_with_role, 
        permission_level, shared_by, shared_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (dashboard_id, shared_with_user_id) 
      DO UPDATE SET permission_level = EXCLUDED.permission_level, shared_at = EXCLUDED.shared_at
      RETURNING *
    `;

    const values = [
      id,
      dashboardId,
      sharedWithUserId,
      sharedWithRole,
      permissionLevel,
      user.id,
      now
    ];

    const result = await db.query(sql, values);
    return this.mapRowToShare(result[0]);
  }

  async unshareDashboard(dashboardId: string, sharedWithUserId: string, user: User): Promise<boolean> {
    const hasAccess = await this.checkDashboardEditAccess(dashboardId, user);
    if (!hasAccess) {
      return false;
    }

    const sql = 'DELETE FROM dashboard_shares WHERE dashboard_id = $1 AND shared_with_user_id = $2';
    const result = await db.query(sql, [dashboardId, sharedWithUserId]);
    
    return result.rowCount > 0;
  }

  // Export operations
  async createExportJob(request: ExportRequest, user: User): Promise<ExportJob> {
    const hasAccess = await this.checkDashboardAccess(request.dashboardId, user);
    if (!hasAccess) {
      throw new Error('Dashboard not found or access denied');
    }

    const id = uuidv4();
    const now = new Date();

    const sql = `
      INSERT INTO export_jobs (
        id, dashboard_id, export_type, format_options, status, created_at, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      id,
      request.dashboardId,
      request.exportType,
      JSON.stringify(request.formatOptions || {}),
      ExportStatus.PENDING,
      now,
      user.id
    ];

    const result = await db.query(sql, values);
    return this.mapRowToExportJob(result[0]);
  }

  async getExportJob(id: string, user: User): Promise<ExportJob | null> {
    const sql = `
      SELECT ej.* FROM export_jobs ej
      JOIN dashboards d ON ej.dashboard_id = d.id
      WHERE ej.id = $1 AND ($2::text IS NULL OR d.facility_id = $2 OR d.is_public = true)
    `;

    const result = await db.query(sql, [id, user.facilityId]);
    
    if (result.length === 0) {
      return null;
    }

    return this.mapRowToExportJob(result[0]);
  }

  async getExportJobsForDashboard(dashboardId: string, user: User): Promise<ExportJob[]> {
    const hasAccess = await this.checkDashboardAccess(dashboardId, user);
    if (!hasAccess) {
      return [];
    }

    const sql = `
      SELECT * FROM export_jobs 
      WHERE dashboard_id = $1
      ORDER BY created_at DESC
    `;

    const result = await db.query(sql, [dashboardId]);
    return result.map(row => this.mapRowToExportJob(row));
  }

  // Private helper methods
  private async checkDashboardAccess(dashboardId: string, user: User): Promise<boolean> {
    // Check if user owns the dashboard or it's public or shared with them
    const sql = `
      SELECT 1 FROM dashboards d
      WHERE d.id = $1 AND (
        d.created_by = $2 OR 
        d.is_public = true OR
        ($3::text IS NULL OR d.facility_id = $3) OR
        EXISTS (
          SELECT 1 FROM dashboard_shares ds 
          WHERE ds.dashboard_id = d.id AND ds.shared_with_user_id = $2
        )
      )
    `;

    const result = await db.query(sql, [dashboardId, user.id, user.facilityId]);
    return result.length > 0;
  }

  private async checkDashboardEditAccess(dashboardId: string, user: User): Promise<boolean> {
    // Check if user can edit the dashboard
    const sql = `
      SELECT 1 FROM dashboards d
      WHERE d.id = $1 AND (
        d.created_by = $2 OR
        EXISTS (
          SELECT 1 FROM dashboard_shares ds 
          WHERE ds.dashboard_id = d.id AND ds.shared_with_user_id = $2
          AND ds.permission_level IN ('edit', 'admin')
        )
      )
    `;

    const result = await db.query(sql, [dashboardId, user.id]);
    return result.length > 0;
  }

  private async getDashboardWidgets(dashboardId: string): Promise<Widget[]> {
    const sql = 'SELECT * FROM widgets WHERE dashboard_id = $1 ORDER BY created_at';
    const result = await db.query(sql, [dashboardId]);
    return result.map(row => this.mapRowToWidget(row));
  }

  private async getDashboardVersions(dashboardId: string): Promise<DashboardVersion[]> {
    const sql = 'SELECT * FROM dashboard_versions WHERE dashboard_id = $1 ORDER BY version DESC';
    const result = await db.query(sql, [dashboardId]);
    return result.map(row => this.mapRowToVersion(row));
  }

  private async getDashboardShares(dashboardId: string): Promise<DashboardShare[]> {
    const sql = 'SELECT * FROM dashboard_shares WHERE dashboard_id = $1 ORDER BY shared_at DESC';
    const result = await db.query(sql, [dashboardId]);
    return result.map(row => this.mapRowToShare(row));
  }

  private async createDashboardVersion(dashboardId: string, user: User, changeDescription?: string): Promise<DashboardVersion> {
    // Get current dashboard and widgets
    const dashboard = await this.getDashboard(dashboardId, user, { includeWidgets: true });
    if (!dashboard) {
      throw new Error('Dashboard not found');
    }

    // Get next version number
    const versionSql = 'SELECT COALESCE(MAX(version), 0) + 1 as next_version FROM dashboard_versions WHERE dashboard_id = $1';
    const versionResult = await db.query(versionSql, [dashboardId]);
    const nextVersion = versionResult[0].next_version;

    const id = uuidv4();
    const now = new Date();

    const sql = `
      INSERT INTO dashboard_versions (
        id, dashboard_id, version, name, description, layout, widgets_snapshot,
        created_at, created_by, change_description, is_published
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      id,
      dashboardId,
      nextVersion,
      `Version ${nextVersion}`,
      dashboard.description,
      JSON.stringify(dashboard.layout),
      JSON.stringify(dashboard.widgets || []),
      now,
      user.id,
      changeDescription,
      false
    ];

    const result = await db.query(sql, values);
    return this.mapRowToVersion(result[0]);
  }

  private generateQueryHash(queryText: string, parameters: Record<string, any> = {}): string {
    const hashInput = `${queryText}:${JSON.stringify(parameters, Object.keys(parameters).sort())}`;
    return crypto.createHash('sha256').update(hashInput).digest('hex');
  }

  private async getCachedWidgetData(widgetId: string, queryHash: string): Promise<WidgetDataCache | null> {
    const sql = `
      SELECT * FROM widget_data_cache 
      WHERE widget_id = $1 AND query_hash = $2 AND expires_at > CURRENT_TIMESTAMP
    `;

    const result = await db.query(sql, [widgetId, queryHash]);
    
    if (result.length === 0) {
      return null;
    }

    return this.mapRowToCache(result[0]);
  }

  private async cacheWidgetData(
    widgetId: string, 
    queryHash: string, 
    data: any, 
    metadata: any
  ): Promise<void> {
    const id = uuidv4();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes cache

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

  private async executeSQLQuery(queryText: string, parameters: Record<string, any> = {}): Promise<any> {
    // Simple parameter substitution (in production, use a proper query builder)
    let query = queryText;
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(parameters)) {
      query = query.replace(new RegExp(`:${key}`, 'g'), `$${paramIndex++}`);
      values.push(value);
    }

    const result = await db.query(query, values);
    return result;
  }

  private async executeMaterializedViewQuery(viewName: string, parameters: Record<string, any> = {}): Promise<any> {
    let query = `SELECT * FROM ${viewName}`;
    const whereConditions: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(parameters)) {
      if (value !== undefined && value !== null) {
        whereConditions.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    }

    if (whereConditions.length > 0) {
      query += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    const result = await db.query(query, values);
    return result;
  }

  // Mapping methods
  private mapRowToDashboard(row: any): Dashboard {
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

  private mapRowToQuery(row: any): WidgetQuery {
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

  private mapRowToCache(row: any): WidgetDataCache {
    return {
      id: row.id,
      widgetId: row.widget_id,
      queryHash: row.query_hash,
      data: JSON.parse(row.data),
      metadata: JSON.parse(row.metadata),
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      refreshCount: row.refresh_count,
      lastRefreshedAt: row.last_refreshed_at
    };
  }

  private mapRowToVersion(row: any): DashboardVersion {
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      version: row.version,
      name: row.name,
      description: row.description,
      layout: JSON.parse(row.layout),
      widgetsSnapshot: JSON.parse(row.widgets_snapshot),
      createdAt: row.created_at,
      createdBy: row.created_by,
      changeDescription: row.change_description,
      isPublished: row.is_published
    };
  }

  private mapRowToShare(row: any): DashboardShare {
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      sharedWithUserId: row.shared_with_user_id,
      sharedWithRole: row.shared_with_role,
      permissionLevel: row.permission_level,
      sharedBy: row.shared_by,
      sharedAt: row.shared_at,
      expiresAt: row.expires_at
    };
  }

  private mapRowToExportJob(row: any): ExportJob {
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
}

export const dashboardService = new DashboardService();
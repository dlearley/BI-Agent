import { db } from '../config/database';
import { redis } from '../config/redis';
import { 
  Dashboard, 
  DashboardWidget, 
  DashboardFilter,
  DataConnector,
  SavedQuery,
  QueryExecutionResult,
  DashboardExport,
  NLSuggestion,
  SchemaColumn
} from '../types';
import crypto from 'crypto';

export class DashboardService {
  // ==================== Dashboards ====================
  
  async getDashboards(organizationId: string): Promise<Dashboard[]> {
    const query = `
      SELECT * FROM dashboards 
      WHERE organization_id = $1 
      ORDER BY updated_at DESC
    `;
    const result = await db.query(query, [organizationId]);
    return result.rows.map(row => this.formatDashboard(row));
  }

  async getDashboardById(dashboardId: string): Promise<Dashboard | null> {
    const query = `
      SELECT * FROM dashboards WHERE id = $1
    `;
    const result = await db.query(query, [dashboardId]);
    if (result.rows.length === 0) return null;
    
    const dashboard = this.formatDashboard(result.rows[0]);
    
    // Get widgets and filters
    dashboard.layout = await this.getDashboardWidgets(dashboardId);
    dashboard.filters = await this.getDashboardFiltersMap(dashboardId);
    
    return dashboard;
  }

  async createDashboard(data: Partial<Dashboard>): Promise<Dashboard> {
    const query = `
      INSERT INTO dashboards 
      (organization_id, name, description, type, layout, filters, is_template, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await db.query(query, [
      data.organizationId,
      data.name,
      data.description || null,
      data.type || 'custom',
      JSON.stringify(data.layout || []),
      JSON.stringify(data.filters || {}),
      data.isTemplate || false,
      data.createdBy || null
    ]);
    
    return this.formatDashboard(result.rows[0]);
  }

  async updateDashboard(dashboardId: string, data: Partial<Dashboard>): Promise<Dashboard> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.type !== undefined) {
      updates.push(`type = $${paramIndex++}`);
      values.push(data.type);
    }
    if (data.layout !== undefined) {
      updates.push(`layout = $${paramIndex++}`);
      values.push(JSON.stringify(data.layout));
    }
    if (data.filters !== undefined) {
      updates.push(`filters = $${paramIndex++}`);
      values.push(JSON.stringify(data.filters));
    }
    if (data.isTemplate !== undefined) {
      updates.push(`is_template = $${paramIndex++}`);
      values.push(data.isTemplate);
    }

    values.push(dashboardId);
    const query = `
      UPDATE dashboards 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return this.formatDashboard(result.rows[0]);
  }

  async deleteDashboard(dashboardId: string): Promise<boolean> {
    const query = 'DELETE FROM dashboards WHERE id = $1';
    const result = await db.query(query, [dashboardId]);
    return result.rowCount > 0;
  }

  // ==================== Dashboard Widgets ====================

  async getDashboardWidgets(dashboardId: string): Promise<DashboardWidget[]> {
    const query = `
      SELECT * FROM dashboard_widgets 
      WHERE dashboard_id = $1 
      ORDER BY position->>'x', position->>'y'
    `;
    const result = await db.query(query, [dashboardId]);
    return result.rows.map(row => this.formatWidget(row));
  }

  async addWidget(widget: Partial<DashboardWidget>): Promise<DashboardWidget> {
    const query = `
      INSERT INTO dashboard_widgets 
      (dashboard_id, query_id, type, title, description, chart_type, config, position, drill_down_config, cross_filter_config)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `;

    const result = await db.query(query, [
      widget.dashboardId,
      widget.queryId || null,
      widget.type,
      widget.title || null,
      widget.description || null,
      widget.chartType || null,
      JSON.stringify(widget.config || {}),
      JSON.stringify(widget.position || { x: 0, y: 0, w: 4, h: 3 }),
      JSON.stringify(widget.drillDownConfig || {}),
      JSON.stringify(widget.crossFilterConfig || {})
    ]);

    return this.formatWidget(result.rows[0]);
  }

  async updateWidget(widgetId: string, widget: Partial<DashboardWidget>): Promise<DashboardWidget> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (widget.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(widget.title);
    }
    if (widget.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(widget.description);
    }
    if (widget.chartType !== undefined) {
      updates.push(`chart_type = $${paramIndex++}`);
      values.push(widget.chartType);
    }
    if (widget.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(widget.config));
    }
    if (widget.position !== undefined) {
      updates.push(`position = $${paramIndex++}`);
      values.push(JSON.stringify(widget.position));
    }
    if (widget.drillDownConfig !== undefined) {
      updates.push(`drill_down_config = $${paramIndex++}`);
      values.push(JSON.stringify(widget.drillDownConfig));
    }
    if (widget.crossFilterConfig !== undefined) {
      updates.push(`cross_filter_config = $${paramIndex++}`);
      values.push(JSON.stringify(widget.crossFilterConfig));
    }

    values.push(widgetId);
    const query = `
      UPDATE dashboard_widgets 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return this.formatWidget(result.rows[0]);
  }

  async removeWidget(widgetId: string): Promise<boolean> {
    const query = 'DELETE FROM dashboard_widgets WHERE id = $1';
    const result = await db.query(query, [widgetId]);
    return result.rowCount > 0;
  }

  // ==================== Dashboard Filters ====================

  async getDashboardFilters(dashboardId: string): Promise<DashboardFilter[]> {
    const query = `
      SELECT * FROM dashboard_filters 
      WHERE dashboard_id = $1 
      ORDER BY created_at
    `;
    const result = await db.query(query, [dashboardId]);
    return result.rows.map(row => this.formatFilter(row));
  }

  async getDashboardFiltersMap(dashboardId: string): Promise<Record<string, DashboardFilter>> {
    const filters = await this.getDashboardFilters(dashboardId);
    const filterMap: Record<string, DashboardFilter> = {};
    filters.forEach(filter => {
      filterMap[filter.id] = filter;
    });
    return filterMap;
  }

  async addDashboardFilter(filter: Partial<DashboardFilter>): Promise<DashboardFilter> {
    const query = `
      INSERT INTO dashboard_filters 
      (dashboard_id, name, field_name, filter_type, default_value, options, is_global)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await db.query(query, [
      filter.dashboardId,
      filter.name,
      filter.fieldName,
      filter.filterType,
      filter.defaultValue ? JSON.stringify(filter.defaultValue) : null,
      filter.options ? JSON.stringify(filter.options) : null,
      filter.isGlobal || false
    ]);

    return this.formatFilter(result.rows[0]);
  }

  async updateDashboardFilter(filterId: string, filter: Partial<DashboardFilter>): Promise<DashboardFilter> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (filter.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(filter.name);
    }
    if (filter.defaultValue !== undefined) {
      updates.push(`default_value = $${paramIndex++}`);
      values.push(filter.defaultValue ? JSON.stringify(filter.defaultValue) : null);
    }
    if (filter.options !== undefined) {
      updates.push(`options = $${paramIndex++}`);
      values.push(filter.options ? JSON.stringify(filter.options) : null);
    }
    if (filter.isGlobal !== undefined) {
      updates.push(`is_global = $${paramIndex++}`);
      values.push(filter.isGlobal);
    }

    values.push(filterId);
    const query = `
      UPDATE dashboard_filters 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return this.formatFilter(result.rows[0]);
  }

  async removeDashboardFilter(filterId: string): Promise<boolean> {
    const query = 'DELETE FROM dashboard_filters WHERE id = $1';
    const result = await db.query(query, [filterId]);
    return result.rowCount > 0;
  }

  // ==================== Data Connectors ====================

  async getDataConnectors(organizationId: string): Promise<DataConnector[]> {
    const query = `
      SELECT * FROM data_connectors 
      WHERE organization_id = $1 
      ORDER BY updated_at DESC
    `;
    const result = await db.query(query, [organizationId]);
    return result.rows.map(row => this.formatConnector(row));
  }

  async getDataConnectorById(connectorId: string): Promise<DataConnector | null> {
    const query = 'SELECT * FROM data_connectors WHERE id = $1';
    const result = await db.query(query, [connectorId]);
    if (result.rows.length === 0) return null;
    return this.formatConnector(result.rows[0]);
  }

  async createDataConnector(data: Partial<DataConnector>): Promise<DataConnector> {
    const query = `
      INSERT INTO data_connectors 
      (organization_id, name, type, config, status)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;

    const result = await db.query(query, [
      data.organizationId,
      data.name,
      data.type,
      JSON.stringify(data.config || {}),
      data.status || 'active'
    ]);

    return this.formatConnector(result.rows[0]);
  }

  async updateDataConnector(connectorId: string, data: Partial<DataConnector>): Promise<DataConnector> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.config !== undefined) {
      updates.push(`config = $${paramIndex++}`);
      values.push(JSON.stringify(data.config));
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramIndex++}`);
      values.push(data.status);
    }

    updates.push(`last_sync_at = CURRENT_TIMESTAMP`);
    values.push(connectorId);

    const query = `
      UPDATE data_connectors 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return this.formatConnector(result.rows[0]);
  }

  async deleteDataConnector(connectorId: string): Promise<boolean> {
    const query = 'DELETE FROM data_connectors WHERE id = $1';
    const result = await db.query(query, [connectorId]);
    return result.rowCount > 0;
  }

  async testDataConnector(connector: DataConnector): Promise<boolean> {
    try {
      // Simple test - can be extended for actual connector validation
      if (!connector.config || !connector.config.host) {
        return false;
      }
      return true;
    } catch (error) {
      console.error('Data connector test failed:', error);
      return false;
    }
  }

  // ==================== Saved Queries ====================

  async getSavedQueries(organizationId: string): Promise<SavedQuery[]> {
    const query = `
      SELECT * FROM saved_queries 
      WHERE organization_id = $1 
      ORDER BY updated_at DESC
    `;
    const result = await db.query(query, [organizationId]);
    return result.rows.map(row => this.formatQuery(row));
  }

  async getSavedQueryById(queryId: string): Promise<SavedQuery | null> {
    const query = 'SELECT * FROM saved_queries WHERE id = $1';
    const result = await db.query(query, [queryId]);
    if (result.rows.length === 0) return null;
    return this.formatQuery(result.rows[0]);
  }

  async createSavedQuery(data: Partial<SavedQuery>): Promise<SavedQuery> {
    const query = `
      INSERT INTO saved_queries 
      (organization_id, name, description, query_text, query_type, parameters, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await db.query(query, [
      data.organizationId,
      data.name,
      data.description || null,
      data.queryText,
      data.queryType || 'custom',
      JSON.stringify(data.parameters || {}),
      data.createdBy || null
    ]);

    return this.formatQuery(result.rows[0]);
  }

  async updateSavedQuery(queryId: string, data: Partial<SavedQuery>): Promise<SavedQuery> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(data.description);
    }
    if (data.queryText !== undefined) {
      updates.push(`query_text = $${paramIndex++}`);
      values.push(data.queryText);
    }
    if (data.queryType !== undefined) {
      updates.push(`query_type = $${paramIndex++}`);
      values.push(data.queryType);
    }
    if (data.parameters !== undefined) {
      updates.push(`parameters = $${paramIndex++}`);
      values.push(JSON.stringify(data.parameters));
    }

    values.push(queryId);
    const query = `
      UPDATE saved_queries 
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return this.formatQuery(result.rows[0]);
  }

  async deleteSavedQuery(queryId: string): Promise<boolean> {
    const query = 'DELETE FROM saved_queries WHERE id = $1';
    const result = await db.query(query, [queryId]);
    return result.rowCount > 0;
  }

  // ==================== Query Execution ====================

  async executeQuery(query: SavedQuery, parameters?: Record<string, any>): Promise<QueryExecutionResult> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey(query.id, parameters);

    try {
      // Check cache first
      const cachedResult = await this.getCachedQueryResult(cacheKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true,
          executionTimeMs: Date.now() - startTime
        };
      }

      // Execute query
      const result = await db.query(query.queryText, Object.values(parameters || {}));
      const executionTime = Date.now() - startTime;

      // Format result
      const queryResult: QueryExecutionResult = {
        id: query.id,
        success: true,
        data: result.rows,
        rowCount: result.rows.length,
        executionTimeMs: executionTime,
        cached: false,
        columns: result.fields?.map(field => ({
          name: field.name,
          type: field.dataTypeID.toString()
        }))
      };

      // Cache result
      await this.cacheQueryResult(query.id, cacheKey, queryResult, parameters);

      return queryResult;
    } catch (error) {
      return {
        id: query.id,
        success: false,
        data: [],
        rowCount: 0,
        executionTimeMs: Date.now() - startTime,
        cached: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private generateCacheKey(queryId: string, parameters?: Record<string, any>): string {
    const paramStr = parameters ? JSON.stringify(parameters) : '';
    return `query:${queryId}:${crypto.createHash('sha256').update(paramStr).digest('hex')}`;
  }

  private async getCachedQueryResult(cacheKey: string): Promise<QueryExecutionResult | null> {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.error('Cache retrieval failed:', error);
    }
    return null;
  }

  private async cacheQueryResult(queryId: string, cacheKey: string, result: QueryExecutionResult, parameters?: Record<string, any>): Promise<void> {
    try {
      const ttl = 3600; // 1 hour
      await redis.setex(cacheKey, ttl, JSON.stringify(result));
      
      // Also store in database for audit/history
      const resultHash = crypto.createHash('sha256').update(JSON.stringify(result.data)).digest('hex');
      await db.query(
        `INSERT INTO query_results_cache 
         (query_id, result_hash, result_data, query_parameters, execution_time_ms, row_count, expires_at, ttl_seconds)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          queryId,
          resultHash,
          JSON.stringify(result.data),
          parameters ? JSON.stringify(parameters) : null,
          result.executionTimeMs,
          result.rowCount,
          new Date(Date.now() + ttl * 1000),
          ttl
        ]
      );
    } catch (error) {
      console.error('Cache storage failed:', error);
    }
  }

  // ==================== NL Suggestions ====================

  async getNLSuggestions(connectorId: string, queryPrefix: string): Promise<NLSuggestion[]> {
    // Check cache first
    const cacheKey = `nl:${connectorId}:${queryPrefix}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Generate suggestions based on schema
    const suggestions = await this.generateNLSuggestions(connectorId, queryPrefix);

    // Cache for 24 hours
    await redis.setex(cacheKey, 86400, JSON.stringify(suggestions));

    return suggestions;
  }

  private async generateNLSuggestions(connectorId: string, queryPrefix: string): Promise<NLSuggestion[]> {
    try {
      const connector = await this.getDataConnectorById(connectorId);
      if (!connector) return [];

      // Get available tables/views from the connector
      const tables = ['orders', 'customers', 'products', 'revenue'];
      
      const suggestions: NLSuggestion[] = [];

      // Generate suggestions based on query prefix
      if (queryPrefix.toLowerCase().includes('total') || queryPrefix.toLowerCase().includes('sum')) {
        suggestions.push({
          query: `SELECT SUM(total) FROM orders`,
          description: 'Total revenue from all orders',
          score: 0.95
        });
      }

      if (queryPrefix.toLowerCase().includes('customer')) {
        suggestions.push({
          query: `SELECT COUNT(*) FROM customers`,
          description: 'Total number of customers',
          score: 0.90
        });
      }

      if (queryPrefix.toLowerCase().includes('product')) {
        suggestions.push({
          query: `SELECT * FROM products LIMIT 10`,
          description: 'List top products',
          score: 0.85
        });
      }

      return suggestions;
    } catch (error) {
      console.error('NL suggestions generation failed:', error);
      return [];
    }
  }

  // ==================== Schema Introspection ====================

  async getConnectorSchema(connectorId: string): Promise<SchemaColumn[]> {
    // For now, return mock schema - in production would introspect actual database
    const mockSchema: SchemaColumn[] = [
      { name: 'id', type: 'uuid', nullable: false },
      { name: 'name', type: 'varchar', nullable: false },
      { name: 'email', type: 'varchar', nullable: true },
      { name: 'total_spent', type: 'decimal', nullable: true },
      { name: 'created_at', type: 'timestamp', nullable: false }
    ];
    return mockSchema;
  }

  // ==================== Dashboard Exports ====================

  async createDashboardExport(dashboardId: string, format: string, createdBy?: string): Promise<DashboardExport> {
    const query = `
      INSERT INTO dashboard_exports 
      (dashboard_id, export_format, status, created_by)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await db.query(query, [
      dashboardId,
      format,
      'pending',
      createdBy || null
    ]);

    const export_ = this.formatExport(result.rows[0]);
    
    // TODO: Trigger async export job
    // await queueService.enqueueExportJob(export_.id);

    return export_;
  }

  async getDashboardExportStatus(exportId: string): Promise<DashboardExport | null> {
    const query = 'SELECT * FROM dashboard_exports WHERE id = $1';
    const result = await db.query(query, [exportId]);
    if (result.rows.length === 0) return null;
    return this.formatExport(result.rows[0]);
  }

  async updateDashboardExport(exportId: string, updates: Partial<DashboardExport>): Promise<DashboardExport> {
    const sets: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.status !== undefined) {
      sets.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }
    if (updates.filePath !== undefined) {
      sets.push(`file_path = $${paramIndex++}`);
      values.push(updates.filePath);
    }
    if (updates.fileSizeBytes !== undefined) {
      sets.push(`file_size_bytes = $${paramIndex++}`);
      values.push(updates.fileSizeBytes);
    }
    if (updates.errorMessage !== undefined) {
      sets.push(`error_message = $${paramIndex++}`);
      values.push(updates.errorMessage);
    }
    if (updates.status === 'completed') {
      sets.push(`completed_at = $${paramIndex}`);
    }

    values.push(exportId);
    const query = `
      UPDATE dashboard_exports 
      SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex + 1}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return this.formatExport(result.rows[0]);
  }

  // ==================== Formatters ====================

  private formatDashboard(row: any): Dashboard {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      type: row.type,
      layout: Array.isArray(row.layout) ? row.layout : JSON.parse(row.layout || '[]'),
      filters: typeof row.filters === 'object' ? row.filters : JSON.parse(row.filters || '{}'),
      isTemplate: row.is_template,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private formatWidget(row: any): DashboardWidget {
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      queryId: row.query_id,
      type: row.type,
      title: row.title,
      description: row.description,
      chartType: row.chart_type,
      config: typeof row.config === 'object' ? row.config : JSON.parse(row.config || '{}'),
      position: typeof row.position === 'object' ? row.position : JSON.parse(row.position || '{}'),
      drillDownConfig: typeof row.drill_down_config === 'object' ? row.drill_down_config : JSON.parse(row.drill_down_config || '{}'),
      crossFilterConfig: typeof row.cross_filter_config === 'object' ? row.cross_filter_config : JSON.parse(row.cross_filter_config || '{}'),
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private formatFilter(row: any): DashboardFilter {
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      name: row.name,
      fieldName: row.field_name,
      filterType: row.filter_type,
      defaultValue: row.default_value ? JSON.parse(row.default_value) : undefined,
      options: row.options ? JSON.parse(row.options) : undefined,
      isGlobal: row.is_global,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private formatConnector(row: any): DataConnector {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      type: row.type,
      config: typeof row.config === 'object' ? row.config : JSON.parse(row.config || '{}'),
      status: row.status,
      lastSyncAt: row.last_sync_at ? new Date(row.last_sync_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private formatQuery(row: any): SavedQuery {
    return {
      id: row.id,
      organizationId: row.organization_id,
      name: row.name,
      description: row.description,
      queryText: row.query_text,
      queryType: row.query_type,
      parameters: typeof row.parameters === 'object' ? row.parameters : JSON.parse(row.parameters || '{}'),
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }

  private formatExport(row: any): DashboardExport {
    return {
      id: row.id,
      dashboardId: row.dashboard_id,
      exportFormat: row.export_format,
      status: row.status,
      filePath: row.file_path,
      fileSizeBytes: row.file_size_bytes,
      exportConfig: row.export_config ? JSON.parse(row.export_config) : {},
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      completedAt: row.completed_at ? new Date(row.completed_at) : undefined,
      errorMessage: row.error_message
    };
  }
}

export const dashboardService = new DashboardService();

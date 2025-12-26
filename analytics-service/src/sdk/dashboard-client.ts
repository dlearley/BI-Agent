/**
 * TypeScript SDK for BI-Agent Dashboard API
 * Generated from OpenAPI specification
 */

export interface DashboardClientConfig {
  baseURL: string;
  apiKey: string;
  timeout?: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  details?: any;
  count?: number;
  cached?: boolean;
  metadata?: any;
}

// Dashboard types
export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  version: number;
  status: 'draft' | 'published' | 'archived';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  tags: string[];
  isPublic: boolean;
  facilityId?: string;
  widgets?: Widget[];
  versions?: DashboardVersion[];
  shares?: DashboardShare[];
}

export interface DashboardLayout {
  grid: {
    cols: number;
    rows: number;
    gap: number;
  };
  widgets: WidgetPosition[];
}

export interface WidgetPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

// Widget types
export interface Widget {
  id: string;
  dashboardId: string;
  name: string;
  type: 'kpi' | 'line' | 'area' | 'bar' | 'table' | 'heatmap' | 'map';
  queryId: string;
  config: WidgetConfig;
  position: WidgetPosition;
  drillThroughConfig?: any;
  crossFilters?: any[];
  refreshInterval: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface WidgetConfig {
  title?: string;
  subtitle?: string;
  colors?: string[];
  legend?: {
    show: boolean;
    position?: 'top' | 'bottom' | 'left' | 'right';
  };
  axes?: {
    x?: {
      label?: string;
      type?: 'category' | 'time' | 'value';
    };
    y?: {
      label?: string;
      min?: number;
      max?: number;
    };
  };
  table?: {
    pagination?: boolean;
    pageSize?: number;
    sortable?: boolean;
    filterable?: boolean;
  };
  kpi?: {
    format?: 'number' | 'currency' | 'percentage';
    trend?: boolean;
    comparison?: {
      period: string;
      type: 'absolute' | 'percentage';
    };
  };
  map?: {
    center?: [number, number];
    zoom?: number;
    layers?: any[];
  };
  [key: string]: any;
}

// Query types
export interface WidgetQuery {
  id: string;
  name: string;
  description?: string;
  queryText: string;
  queryType: 'sql' | 'materialized_view';
  materializedViewName?: string;
  parameters: QueryParameter[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  isTemplate: boolean;
}

export interface QueryParameter {
  name: string;
  type: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  defaultValue?: any;
  description?: string;
}

// Export types
export interface ExportJob {
  id: string;
  dashboardId: string;
  exportType: 'pdf' | 'png';
  formatOptions: ExportFormatOptions;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  filePath?: string;
  fileSize?: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

export interface ExportFormatOptions {
  paperSize?: 'A4' | 'A3' | 'Letter' | 'Legal';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  quality?: number; // For PNG
  scale?: number; // For PDF
  includeFilters?: boolean;
  includeTimestamp?: boolean;
  customHeader?: string;
  customFooter?: string;
}

// Version and Share types
export interface DashboardVersion {
  id: string;
  dashboardId: string;
  version: number;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgetsSnapshot: Widget[];
  createdAt: string;
  createdBy: string;
  changeDescription?: string;
  isPublished: boolean;
}

export interface DashboardShare {
  id: string;
  dashboardId: string;
  sharedWithUserId?: string;
  sharedWithRole?: string;
  permissionLevel: 'view' | 'edit' | 'admin';
  sharedBy: string;
  sharedAt: string;
  expiresAt?: string;
}

// Request types
export interface CreateDashboardRequest {
  name: string;
  description?: string;
  layout?: DashboardLayout;
  tags?: string[];
  isPublic?: boolean;
}

export interface UpdateDashboardRequest {
  name?: string;
  description?: string;
  layout?: DashboardLayout;
  tags?: string[];
  isPublic?: boolean;
}

export interface CreateWidgetRequest {
  dashboardId: string;
  name: string;
  type: 'kpi' | 'line' | 'area' | 'bar' | 'table' | 'heatmap' | 'map';
  queryId: string;
  config: WidgetConfig;
  position: WidgetPosition;
  drillThroughConfig?: any;
  crossFilters?: any[];
  refreshInterval?: number;
}

export interface UpdateWidgetRequest {
  name?: string;
  config?: WidgetConfig;
  position?: WidgetPosition;
  drillThroughConfig?: any;
  crossFilters?: any[];
  refreshInterval?: number;
}

export interface CreateQueryRequest {
  name: string;
  description?: string;
  queryText: string;
  queryType?: 'sql' | 'materialized_view';
  materializedViewName?: string;
  parameters?: QueryParameter[];
  isTemplate?: boolean;
}

export interface WidgetDataRequest {
  widgetId: string;
  parameters?: Record<string, any>;
  forceRefresh?: boolean;
  useCache?: boolean;
}

export interface ExportRequest {
  dashboardId: string;
  exportType: 'pdf' | 'png';
  formatOptions?: ExportFormatOptions;
  widgetIds?: string[];
  filters?: Record<string, any>;
}

export interface DashboardQueryOptions {
  includeWidgets?: boolean;
  includeVersions?: boolean;
  includeShares?: boolean;
  status?: 'draft' | 'published' | 'archived';
  tags?: string[];
  createdBy?: string;
  facilityId?: string;
}

/**
 * Dashboard API Client
 */
export class DashboardClient {
  private config: DashboardClientConfig;

  constructor(config: DashboardClientConfig) {
    this.config = {
      timeout: 30000,
      ...config
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.config.baseURL}${endpoint}`;
    
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.config.apiKey}`,
      ...options.headers
    };

    const response = await fetch(url, {
      ...options,
      headers,
      signal: AbortSignal.timeout(this.config.timeout!)
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return data;
  }

  // Dashboard operations
  async getDashboards(options?: DashboardQueryOptions): Promise<ApiResponse<Dashboard[]>> {
    const params = new URLSearchParams();
    
    if (options?.includeWidgets) params.append('includeWidgets', 'true');
    if (options?.includeVersions) params.append('includeVersions', 'true');
    if (options?.includeShares) params.append('includeShares', 'true');
    if (options?.status) params.append('status', options.status);
    if (options?.tags) options.tags.forEach(tag => params.append('tags', tag));
    if (options?.createdBy) params.append('createdBy', options.createdBy);
    if (options?.facilityId) params.append('facilityId', options.facilityId);

    const query = params.toString();
    return this.request<Dashboard[]>(`/dashboard/dashboards${query ? `?${query}` : ''}`);
  }

  async getDashboard(id: string, options?: DashboardQueryOptions): Promise<ApiResponse<Dashboard>> {
    const params = new URLSearchParams();
    
    if (options?.includeWidgets) params.append('includeWidgets', 'true');
    if (options?.includeVersions) params.append('includeVersions', 'true');
    if (options?.includeShares) params.append('includeShares', 'true');

    const query = params.toString();
    return this.request<Dashboard>(`/dashboard/dashboards/${id}${query ? `?${query}` : ''}`);
  }

  async createDashboard(request: CreateDashboardRequest): Promise<ApiResponse<Dashboard>> {
    return this.request<Dashboard>('/dashboard/dashboards', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async updateDashboard(id: string, request: UpdateDashboardRequest): Promise<ApiResponse<Dashboard>> {
    return this.request<Dashboard>(`/dashboard/dashboards/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request)
    });
  }

  async deleteDashboard(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/dashboard/dashboards/${id}`, {
      method: 'DELETE'
    });
  }

  async publishDashboard(id: string): Promise<ApiResponse<Dashboard>> {
    return this.request<Dashboard>(`/dashboard/dashboards/${id}/publish`, {
      method: 'POST'
    });
  }

  // Widget operations
  async getWidget(id: string): Promise<ApiResponse<Widget>> {
    return this.request<Widget>(`/dashboard/widgets/${id}`);
  }

  async createWidget(request: CreateWidgetRequest): Promise<ApiResponse<Widget>> {
    return this.request<Widget>('/dashboard/widgets', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async updateWidget(id: string, request: UpdateWidgetRequest): Promise<ApiResponse<Widget>> {
    return this.request<Widget>(`/dashboard/widgets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request)
    });
  }

  async deleteWidget(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/dashboard/widgets/${id}`, {
      method: 'DELETE'
    });
  }

  async getWidgetData(request: WidgetDataRequest): Promise<ApiResponse<any>> {
    return this.request<any>('/dashboard/widgets/data', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // Query operations
  async getQueries(includeTemplates: boolean = false): Promise<ApiResponse<WidgetQuery[]>> {
    const params = new URLSearchParams();
    if (includeTemplates) params.append('includeTemplates', 'true');
    
    return this.request<WidgetQuery[]>(`/dashboard/queries${params.toString() ? `?${params.toString()}` : ''}`);
  }

  async getQuery(id: string): Promise<ApiResponse<WidgetQuery>> {
    return this.request<WidgetQuery>(`/dashboard/queries/${id}`);
  }

  async createQuery(request: CreateQueryRequest): Promise<ApiResponse<WidgetQuery>> {
    return this.request<WidgetQuery>('/dashboard/queries', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  // Export operations
  async createExportJob(request: ExportRequest): Promise<ApiResponse<ExportJob>> {
    return this.request<ExportJob>('/dashboard/exports', {
      method: 'POST',
      body: JSON.stringify(request)
    });
  }

  async getExportJob(id: string): Promise<ApiResponse<ExportJob>> {
    return this.request<ExportJob>(`/dashboard/exports/${id}`);
  }

  async getExportJobsForDashboard(dashboardId: string): Promise<ApiResponse<ExportJob[]>> {
    return this.request<ExportJob[]>(`/dashboard/dashboards/${dashboardId}/exports`);
  }

  // Utility methods
  async waitForExportCompletion(
    exportJobId: string, 
    pollInterval: number = 2000, 
    maxAttempts: number = 30
  ): Promise<ExportJob> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const response = await this.getExportJob(exportJobId);
      
      if (!response.data) {
        throw new Error('Export job not found');
      }

      const job = response.data;
      
      if (job.status === 'completed') {
        return job;
      }
      
      if (job.status === 'failed') {
        throw new Error(job.errorMessage || 'Export job failed');
      }
      
      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
      attempts++;
    }
    
    throw new Error('Export job did not complete within the expected time');
  }

  async downloadExportFile(exportJob: ExportJob): Promise<Blob> {
    if (!exportJob.filePath) {
      throw new Error('Export file path not available');
    }

    const response = await fetch(`${this.config.baseURL}/exports/${exportJob.id}/download`, {
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to download export: ${response.statusText}`);
    }

    return response.blob();
  }

  // Batch operations
  async createWidgets(requests: CreateWidgetRequest[]): Promise<ApiResponse<Widget[]>> {
    const promises = requests.map(request => this.createWidget(request));
    const results = await Promise.allSettled(promises);
    
    const widgets: Widget[] = [];
    const errors: any[] = [];
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.data) {
          widgets.push(result.value.data);
        }
      } else {
        errors.push({
          index,
          error: result.reason.message
        });
      }
    });
    
    if (errors.length > 0) {
      throw new Error(`Failed to create some widgets: ${JSON.stringify(errors)}`);
    }
    
    return {
      success: true,
      data: widgets,
      count: widgets.length
    };
  }

  async refreshDashboardWidgets(dashboardId: string): Promise<void> {
    // Get all widgets for the dashboard
    const dashboardResponse = await this.getDashboard(dashboardId, { includeWidgets: true });
    
    if (!dashboardResponse.data?.widgets) {
      throw new Error('No widgets found for dashboard');
    }
    
    // Refresh each widget's data
    const promises = dashboardResponse.data.widgets.map(widget =>
      this.getWidgetData({
        widgetId: widget.id,
        forceRefresh: true,
        useCache: false
      })
    );
    
    await Promise.allSettled(promises);
  }
}

/**
 * Factory function to create a dashboard client
 */
export function createDashboardClient(config: DashboardClientConfig): DashboardClient {
  return new DashboardClient(config);
}

/**
 * Default export
 */
export default DashboardClient;
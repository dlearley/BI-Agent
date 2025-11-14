export interface User {
  id: string;
  email: string;
  role: UserRole;
  facilityId?: string;
  permissions: Permission[];
}

export enum UserRole {
  ADMIN = 'admin',
  RECRUITER = 'recruiter',
  VIEWER = 'viewer'
}

export enum Permission {
  VIEW_ANALYTICS = 'view_analytics',
  VIEW_FACILITY_ANALYTICS = 'view_facility_analytics',
  MANAGE_ANALYTICS = 'manage_analytics',
  VIEW_PII = 'view_pii',
  VIEW_AUDIT_LOGS = 'view_audit_logs',
  MANAGE_GOVERNANCE = 'manage_governance',
  EXPORT_DATA = 'export_data',
  VIEW_VERSIONED_METRICS = 'view_versioned_metrics',
  MANAGE_DASHBOARDS = 'manage_dashboards',
  VIEW_DASHBOARDS = 'view_dashboards',
  SHARE_DASHBOARDS = 'share_dashboards'
}

export interface AnalyticsKPI {
  pipelineCount: number;
  timeToFill: number;
  complianceStatus: ComplianceMetrics;
  revenue: RevenueMetrics;
  outreachEffectiveness: OutreachMetrics;
}

export interface ComplianceMetrics {
  totalApplications: number;
  compliantApplications: number;
  complianceRate: number;
  violations: ComplianceViolation[];
}

export interface ComplianceViolation {
  type: string;
  count: number;
  severity: 'low' | 'medium' | 'high';
}

export interface RevenueMetrics {
  totalRevenue: number;
  averageRevenuePerPlacement: number;
  revenueByFacility: FacilityRevenue[];
  revenueByMonth: MonthlyRevenue[];
}

export interface FacilityRevenue {
  facilityId: string;
  facilityName: string;
  revenue: number;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
}

export interface OutreachMetrics {
  totalOutreach: number;
  responseRate: number;
  conversionRate: number;
  effectiveChannels: ChannelMetrics[];
}

export interface ChannelMetrics {
  channel: string;
  outreach: number;
  responses: number;
  conversions: number;
}

export interface AnalyticsQuery {
  startDate?: string;
  endDate?: string;
  facilityId?: string;
  includePII?: boolean;
}

export interface CacheOptions {
  ttl?: number;
  key: string;
}

export interface JobData {
  type: 'refresh_analytics' | 'refresh_view';
  viewName?: string;
  facilityId?: string;
}

export interface JobResult {
  success: boolean;
  message: string;
  data?: any;
  error?: string;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl?: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

export interface AppConfig {
  database: DatabaseConfig;
  redis: RedisConfig;
  jwt: {
    secret: string;
    expiresIn: string;
  };
  hipaa: {
    enabled: boolean;
    minThreshold: number;
  };
  analytics: {
    refreshInterval: number;
    cacheTTL: number;
  };
  mlService: {
    url: string;
    timeout: number;
  };
  governance: GovernanceConfig;
  port?: number;
  apiVersion?: string;
  nodeEnv?: string;
}

// Forecasting types
export enum ForecastModel {
  PROPHET = 'prophet',
  ARIMA = 'arima',
  XGBOOST = 'xgboost'
}

export enum ForecastMetric {
  REVENUE = 'revenue',
  PIPELINE_COUNT = 'pipeline_count',
  TIME_TO_FILL = 'time_to_fill',
  COMPLIANCE_RATE = 'compliance_rate',
  OUTREACH_RESPONSE_RATE = 'outreach_response_rate'
}

export interface ForecastRequest {
  metric: ForecastMetric;
  model: ForecastModel;
  startDate: string;
  endDate: string;
  horizon: number; // Number of periods to forecast
  frequency: 'daily' | 'weekly' | 'monthly';
  assumptions?: ForecastAssumptions;
  backtest?: {
    enabled: boolean;
    testPeriods: number;
  };
}

export interface ForecastAssumptions {
  growthRate?: number;
  seasonality?: number;
  trend?: number;
  externalFactors?: Record<string, number>;
}

export interface ForecastResponse {
  id: string;
  metric: ForecastMetric;
  model: ForecastModel;
  predictions: ForecastPoint[];
  backtest?: BacktestResults;
  assumptions: ForecastAssumptions;
  metadata: {
    createdAt: string;
    modelAccuracy: number;
    dataPoints: number;
  };
}

export interface ForecastPoint {
  date: string;
  value: number;
  confidenceInterval: {
    lower: number;
    upper: number;
  };
}

export interface BacktestResults {
  mae: number; // Mean Absolute Error
  rmse: number; // Root Mean Square Error
  mape: number; // Mean Absolute Percentage Error
  r2: number; // R-squared
  actualVsPredicted: Array<{
    date: string;
    actual: number;
    predicted: number;
  }>;
}

export interface ForecastScenario {
  id: string;
  name: string;
  description?: string;
  forecastId: string;
  assumptions: ForecastAssumptions;
  createdAt: string;
  createdBy: string;
  isReport: boolean;
}

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface Anomaly {
  timestamp: string;
  value: number;
  expectedValue: number;
  score: number;
  severity: 'low' | 'medium' | 'high';
}

export interface AnomalyResult {
  anomalies: Anomaly[];
  statistics: {
    mean: number;
    stdDev: number;
    threshold: number;
    method: string;
  };
}

export interface FeatureImportance {
  feature: string;
  importance: number;
  contribution: number;
  direction: 'positive' | 'negative';
}

export interface DriversResult {
  drivers: FeatureImportance[];
  metadata: {
    method: string;
    totalFeatures: number;
    samplesAnalyzed: number;
  };
}

export interface TrendAnalysis {
  direction: 'increasing' | 'decreasing' | 'stable';
  strength: number;
  variance: number;
  changeRate: number;
}

export interface InsightsReport {
  id: string;
  timestamp: string;
  query: AnalyticsQuery;
  anomalies: {
    detected: Anomaly[];
    statistics: any;
    totalPoints: number;
    anomalyRate: number;
  };
  drivers: {
    topDrivers: FeatureImportance[];
    metadata: any;
  };
  trends: TrendAnalysis;
  narrative: string;
}

export interface GovernanceConfig {
  auditLog: {
    enabled: boolean;
    retention: {
      hipaa: number; // days
      gdpr: number; // days
      soc2: number; // days
    };
    sensitiveFields: string[];
  };
  compliancePresets: {
    hipaa: CompliancePreset;
    gdpr: CompliancePreset;
    soc2: CompliancePreset;
  };
  rowLevelSecurity: {
    enabled: boolean;
    defaultPolicy: 'deny' | 'allow';
  };
  columnLevelSecurity: {
    enabled: boolean;
    piiColumns: string[];
    restrictedColumns: string[];
  };
  metricVersioning: {
    enabled: boolean;
    retention: number; // versions to keep
  };
}

export interface CompliancePreset {
  name: string;
  description: string;
  dataRetention: number; // days
  piiMasking: {
    enabled: boolean;
    fields: string[];
    maskingStrategy: 'full' | 'partial' | 'hash';
  };
  auditRequirements: {
    logAllAccess: boolean;
    logDataChanges: boolean;
    logFailedAttempts: boolean;
  };
  exportRestrictions: {
    enabled: boolean;
    approvalRequired: boolean;
    maxRecords: number;
  };
}

export interface AuditLogEntry {
  id: string;
  userId: string;
  userEmail: string;
  userRole: UserRole;
  action: string;
  resource: string;
  resourceId?: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  facilityId?: string;
  details: Record<string, any>;
  success: boolean;
  errorMessage?: string;
  complianceFramework?: 'hipaa' | 'gdpr' | 'soc2';
}

export interface MetricVersion {
  id: string;
  metricType: string;
  metricId: string;
  version: number;
  data: any;
  timestamp: Date;
  createdBy: string;
  changeDescription?: string;
  complianceFramework?: 'hipaa' | 'gdpr' | 'soc2';
}

// Dashboard types
export enum WidgetType {
  KPI = 'kpi',
  LINE = 'line',
  AREA = 'area',
  BAR = 'bar',
  TABLE = 'table',
  HEATMAP = 'heatmap',
  MAP = 'map'
}

export enum DashboardStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  ARCHIVED = 'archived'
}

export enum ExportType {
  PDF = 'pdf',
  PNG = 'png'
}

export enum ExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  layout: DashboardLayout;
  version: number;
  status: DashboardStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt?: Date;
  tags: string[];
  isPublic: boolean;
  facilityId?: string;
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

export interface Widget {
  id: string;
  dashboardId: string;
  name: string;
  type: WidgetType;
  queryId: string;
  config: WidgetConfig;
  position: WidgetPosition;
  drillThroughConfig?: DrillThroughConfig;
  crossFilters?: CrossFilter[];
  refreshInterval: number;
  createdAt: Date;
  updatedAt: Date;
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
    layers?: MapLayer[];
  };
  [key: string]: any;
}

export interface MapLayer {
  type: 'choropleth' | 'scatter' | 'heatmap';
  data: any;
  options: any;
}

export interface DrillThroughConfig {
  enabled: boolean;
  targetDashboard?: string;
  targetWidget?: string;
  filters?: DrillThroughFilter[];
}

export interface DrillThroughFilter {
  sourceField: string;
  targetField: string;
  type: 'equals' | 'contains' | 'greater_than' | 'less_than';
}

export interface CrossFilter {
  sourceWidget: string;
  targetWidget: string;
  field: string;
  type: 'filter' | 'highlight';
}

export interface WidgetQuery {
  id: string;
  name: string;
  description?: string;
  queryText: string;
  queryType: 'sql' | 'materialized_view';
  materializedViewName?: string;
  parameters: QueryParameter[];
  createdAt: Date;
  updatedAt: Date;
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

export interface WidgetDataCache {
  id: string;
  widgetId: string;
  queryHash: string;
  data: any;
  metadata: {
    rowCount?: number;
    executionTime?: number;
    lastUpdated?: Date;
  };
  createdAt: Date;
  expiresAt: Date;
  refreshCount: number;
  lastRefreshedAt: Date;
}

export interface DashboardVersion {
  id: string;
  dashboardId: string;
  version: number;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgetsSnapshot: Widget[];
  createdAt: Date;
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
  sharedAt: Date;
  expiresAt?: Date;
}

export interface ExportJob {
  id: string;
  dashboardId: string;
  exportType: ExportType;
  formatOptions: ExportFormatOptions;
  status: ExportStatus;
  filePath?: string;
  fileSize?: number;
  errorMessage?: string;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
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

// Request/Response types for API
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
  type: WidgetType;
  queryId: string;
  config: WidgetConfig;
  position: WidgetPosition;
  drillThroughConfig?: DrillThroughConfig;
  crossFilters?: CrossFilter[];
  refreshInterval?: number;
}

export interface UpdateWidgetRequest {
  name?: string;
  config?: WidgetConfig;
  position?: WidgetPosition;
  drillThroughConfig?: DrillThroughConfig;
  crossFilters?: CrossFilter[];
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

export interface DashboardQueryOptions {
  includeWidgets?: boolean;
  includeVersions?: boolean;
  includeShares?: boolean;
  status?: DashboardStatus;
  tags?: string[];
  createdBy?: string;
  facilityId?: string;
}

export interface WidgetDataRequest {
  widgetId: string;
  parameters?: Record<string, any>;
  forceRefresh?: boolean;
  useCache?: boolean;
}

export interface ExportRequest {
  dashboardId: string;
  exportType: ExportType;
  formatOptions?: ExportFormatOptions;
  widgetIds?: string[]; // Export specific widgets only
  filters?: Record<string, any>; // Apply filters before export
}

export interface SecurityContext {
  user: User;
  complianceFramework: 'hipaa' | 'gdpr' | 'soc2';
  preset: CompliancePreset;
  auditRequired: boolean;
  piiAccess: boolean;
  facilityScope?: string;
}
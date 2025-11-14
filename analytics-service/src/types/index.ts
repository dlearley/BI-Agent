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
  VIEW_VERSIONED_METRICS = 'view_versioned_metrics'
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

export interface SecurityContext {
  user: User;
  complianceFramework: 'hipaa' | 'gdpr' | 'soc2';
  preset: CompliancePreset;
  auditRequired: boolean;
  piiAccess: boolean;
  facilityScope?: string;
}
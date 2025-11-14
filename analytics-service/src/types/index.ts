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
  VIEW_PII = 'view_pii'
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
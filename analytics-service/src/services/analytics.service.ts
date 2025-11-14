import { db } from '../config/database';
import { redis } from '../config/redis';
import { 
  AnalyticsKPI, 
  AnalyticsQuery, 
  ComplianceMetrics, 
  RevenueMetrics, 
  OutreachMetrics,
  User,
  FacilityRevenue,
  MonthlyRevenue,
  ChannelMetrics,
  ComplianceViolation,
  SecurityContext
} from '../types';
import config from '../config';
import { applyHIPAARedaction, enforceMinimumThreshold } from '../middleware/hipaa';
import { governanceService } from './governance.service';
import { piiMaskingService } from './pii-masking.service';
import { metricVersioningService } from './metric-versioning.service';
import { applyRowLevelSecurity, applyColumnLevelSecurity } from '../middleware/rbac';

export class AnalyticsService {
  private readonly cachePrefix = 'analytics:';
  private readonly defaultCacheTTL = config.analytics.cacheTTL;

  private async createSecurityContext(user: User, framework: 'hipaa' | 'gdpr' | 'soc2' = 'hipaa'): Promise<SecurityContext> {
    return await governanceService.applyCompliancePreset(framework, user);
  }

  private async applyGovernanceFilters(
    data: any[], 
    securityContext: SecurityContext,
    restrictedColumns?: string[]
  ): Promise<any[]> {
    let filteredData = data;

    // Apply column-level security
    if (restrictedColumns && restrictedColumns.length > 0) {
      filteredData = applyColumnLevelSecurity(filteredData, restrictedColumns);
    }

    // Apply PII masking
    filteredData = filteredData.map(item => 
      piiMaskingService.maskData(item, securityContext)
    );

    // Apply HIPAA minimum threshold enforcement
    filteredData = filteredData.map(item => enforceMinimumThreshold(item));

    return filteredData;
  }

  async getPipelineKPIs(query: AnalyticsQuery, user: User, complianceFramework: 'hipaa' | 'gdpr' | 'soc2' = 'hipaa'): Promise<any> {
    const securityContext = await this.createSecurityContext(user, complianceFramework);
    const cacheKey = this.generateCacheKey('pipeline', query, user, complianceFramework);
    
    // Try to get from cache first
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT 
        facility_id,
        facility_name,
        SUM(total_applications) as total_applications,
        SUM(hired_count) as hired_count,
        SUM(rejected_count) as rejected_count,
        SUM(pending_count) as pending_count,
        SUM(interview_count) as interview_count,
        ROUND(AVG(avg_time_to_fill_days), 2) as avg_time_to_fill_days
      FROM analytics.pipeline_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND month >= ${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND month <= ${paramIndex++}`;
      params.push(query.endDate);
    }

    // Apply row-level security
    const rowFilter = this.buildRowLevelFilter(user, query);
    if (rowFilter) {
      sql += ` AND ${rowFilter}`;
    }

    sql += ` GROUP BY facility_id, facility_name`;

    // Apply row-level security to SQL
    const secureSQL = applyRowLevelSecurity(sql, rowFilter);
    const results = await db.query(secureSQL, params);
    
    // Apply governance filters
    const restrictedColumns = config.governance.columnLevelSecurity.enabled 
      ? config.governance.columnLevelSecurity.restrictedColumns 
      : [];
    
    const processedResults = await this.applyGovernanceFilters(
      results, 
      securityContext, 
      restrictedColumns
    );

    // Create metric version if enabled
    if (config.governance.metricVersioning.enabled) {
      await metricVersioningService.createVersion(
        'pipeline_kpis',
        `pipeline_${user.facilityId || 'all'}_${Date.now()}`,
        processedResults,
        user,
        'Pipeline KPIs query',
        complianceFramework
      );
    }

    // Cache the results
    await redis.set(cacheKey, processedResults, this.defaultCacheTTL);

    return processedResults;
  }

  async getComplianceMetrics(query: AnalyticsQuery, user: User): Promise<ComplianceMetrics[]> {
    const cacheKey = this.generateCacheKey('compliance', query, user);
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT 
        facility_id,
        SUM(total_applications) as total_applications,
        SUM(compliant_applications) as compliant_applications,
        ROUND(AVG(avg_compliance_score), 2) as avg_compliance_score,
        SUM(violation_count) as violation_count
      FROM analytics.compliance_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(query.endDate);
    }

    if (user.role === 'recruiter' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    } else if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    sql += ` GROUP BY facility_id`;

    const results = await db.query(sql, params);
    
    const complianceMetricsPromises = results.map(async (row) => ({
      totalApplications: parseInt(row.total_applications),
      compliantApplications: parseInt(row.compliant_applications),
      complianceRate: row.total_applications > 0 
        ? (row.compliant_applications / row.total_applications) * 100 
        : 0,
      violations: await this.getComplianceViolations(row.facility_id, user)
    }));
    
    const complianceMetrics: ComplianceMetrics[] = await Promise.all(complianceMetricsPromises);

    const processedResults = complianceMetrics.map(metrics => 
      applyHIPAARedaction(metrics, user)
    );
    
    const finalResults = enforceMinimumThreshold(processedResults);

    await redis.set(cacheKey, finalResults, this.defaultCacheTTL);

    return finalResults;
  }

  async getRevenueMetrics(query: AnalyticsQuery, user: User): Promise<RevenueMetrics> {
    const cacheKey = this.generateCacheKey('revenue', query, user);
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT 
        facility_id,
        SUM(total_revenue) as total_revenue,
        SUM(total_invoices) as total_invoices,
        ROUND(AVG(avg_revenue_per_invoice), 2) as avg_revenue_per_invoice
      FROM analytics.revenue_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(query.endDate);
    }

    if (user.role === 'recruiter' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    } else if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    const results = await db.query(sql, params);

    const totalRevenue = results.reduce((sum, row) => sum + parseFloat(row.total_revenue), 0);
    const totalInvoices = results.reduce((sum, row) => sum + parseInt(row.total_invoices), 0);
    const avgRevenuePerPlacement = totalInvoices > 0 ? totalRevenue / totalInvoices : 0;

    const revenueByFacility: FacilityRevenue[] = results.map(row => ({
      facilityId: row.facility_id,
      facilityName: `Facility ${row.facility_id}`, // In real app, fetch from facilities table
      revenue: parseFloat(row.total_revenue)
    }));

    const revenueByMonth: MonthlyRevenue[] = await this.getRevenueByMonth(query, user);

    const revenueMetrics: RevenueMetrics = {
      totalRevenue,
      averageRevenuePerPlacement: avgRevenuePerPlacement,
      revenueByFacility,
      revenueByMonth
    };

    const processedResult = applyHIPAARedaction(revenueMetrics, user);
    const finalResult = enforceMinimumThreshold(processedResult);

    await redis.set(cacheKey, finalResult, this.defaultCacheTTL);

    return finalResult;
  }

  async getOutreachMetrics(query: AnalyticsQuery, user: User): Promise<OutreachMetrics> {
    const cacheKey = this.generateCacheKey('outreach', query, user);
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT 
        SUM(total_outreach) as total_outreach,
        SUM(responses) as responses,
        SUM(conversions) as conversions
      FROM analytics.outreach_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(query.endDate);
    }

    if (user.role === 'recruiter' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    } else if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    const result = await db.queryOne(sql, params);
    const totalOutreach = parseInt(result?.total_outreach || '0');
    const responses = parseInt(result?.responses || '0');
    const conversions = parseInt(result?.conversions || '0');

    const effectiveChannels = await this.getChannelMetrics(query, user);

    const outreachMetrics: OutreachMetrics = {
      totalOutreach,
      responseRate: totalOutreach > 0 ? (responses / totalOutreach) * 100 : 0,
      conversionRate: totalOutreach > 0 ? (conversions / totalOutreach) * 100 : 0,
      effectiveChannels
    };

    const processedResult = applyHIPAARedaction(outreachMetrics, user);
    const finalResult = enforceMinimumThreshold(processedResult);

    await redis.set(cacheKey, finalResult, this.defaultCacheTTL);

    return finalResult;
  }

  async getCombinedKPIs(query: AnalyticsQuery, user: User): Promise<AnalyticsKPI[]> {
    const cacheKey = this.generateCacheKey('combined', query, user);
    
    const cached = await redis.get(cacheKey);
    if (cached) {
      return cached;
    }

    let sql = `
      SELECT 
        facility_id,
        SUM(total_applications) as total_applications,
        SUM(hired_count) as hired_count,
        ROUND(AVG(avg_time_to_fill_days), 2) as avg_time_to_fill_days,
        SUM(compliant_applications) as compliant_applications,
        ROUND(AVG(avg_compliance_score), 2) as avg_compliance_score,
        SUM(violation_count) as violation_count,
        SUM(total_revenue) as total_revenue,
        ROUND(AVG(avg_revenue_per_invoice), 2) as avg_revenue_per_invoice,
        SUM(total_outreach) as total_outreach,
        ROUND(AVG(avg_response_rate), 2) as avg_response_rate,
        ROUND(AVG(avg_conversion_rate), 2) as avg_conversion_rate
      FROM analytics.combined_kpis
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(query.endDate);
    }

    if (user.role === 'recruiter' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    } else if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    sql += ` GROUP BY facility_id`;

    const results = await db.query(sql, params);

    const kpis: AnalyticsKPI[] = results.map(row => ({
      pipelineCount: parseInt(row.total_applications),
      timeToFill: parseFloat(row.avg_time_to_fill_days) || 0,
      complianceStatus: {
        totalApplications: parseInt(row.total_applications),
        compliantApplications: parseInt(row.compliant_applications),
        complianceRate: row.total_applications > 0 
          ? (row.compliant_applications / row.total_applications) * 100 
          : 0,
        violations: [] // Would be populated separately
      },
      revenue: {
        totalRevenue: parseFloat(row.total_revenue),
        averageRevenuePerPlacement: parseFloat(row.avg_revenue_per_invoice) || 0,
        revenueByFacility: [],
        revenueByMonth: []
      },
      outreachEffectiveness: {
        totalOutreach: parseInt(row.total_outreach),
        responseRate: parseFloat(row.avg_response_rate) || 0,
        conversionRate: parseFloat(row.avg_conversion_rate) || 0,
        effectiveChannels: []
      }
    }));

    const processedResults = kpis.map(kpi => applyHIPAARedaction(kpi, user));
    const finalResults = enforceMinimumThreshold(processedResults);

    await redis.set(cacheKey, finalResults, this.defaultCacheTTL);

    return finalResults;
  }

  async refreshMaterializedViews(viewName?: string): Promise<void> {
    try {
      if (viewName) {
        switch (viewName) {
          case 'pipeline':
            await db.query('SELECT analytics.refresh_pipeline_kpis()');
            break;
          case 'compliance':
            await db.query('SELECT analytics.refresh_compliance_kpis()');
            break;
          case 'revenue':
            await db.query('SELECT analytics.refresh_revenue_kpis()');
            break;
          case 'outreach':
            await db.query('SELECT analytics.refresh_outreach_kpis()');
            break;
          default:
            throw new Error(`Unknown view: ${viewName}`);
        }
      } else {
        await db.query('SELECT analytics.refresh_all_analytics()');
      }

      // Clear cache after refresh
      await this.clearCache();
    } catch (error) {
      throw new Error(`Failed to refresh materialized views: ${error}`);
    }
  }

  async getLastRefreshTimes(): Promise<any> {
    const results = await db.query('SELECT * FROM analytics.get_last_refresh()');
    return results;
  }

  private async getComplianceViolations(_facilityId: string, _user: User): Promise<ComplianceViolation[]> {
    // In a real implementation, this would query a violations table
    // For now, return mock data
    return [
      {
        type: 'documentation_missing',
        count: 3,
        severity: 'medium' as const
      },
      {
        type: 'timeline_exceeded',
        count: 1,
        severity: 'low' as const
      }
    ];
  }

  private async getRevenueByMonth(query: AnalyticsQuery, user: User): Promise<MonthlyRevenue[]> {
    let sql = `
      SELECT 
        DATE_TRUNC('month', month) as month,
        SUM(total_revenue) as revenue
      FROM analytics.revenue_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(query.endDate);
    }

    if (user.role === 'recruiter' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    } else if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    sql += ` GROUP BY DATE_TRUNC('month', month) ORDER BY month`;

    const results = await db.query(sql, params);
    return results.map(row => ({
      month: row.month.toISOString().split('T')[0],
      revenue: parseFloat(row.revenue)
    }));
  }

  private async getChannelMetrics(query: AnalyticsQuery, user: User): Promise<ChannelMetrics[]> {
    let sql = `
      SELECT 
        channel,
        SUM(total_outreach) as total_outreach,
        SUM(responses) as responses,
        SUM(conversions) as conversions
      FROM analytics.outreach_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (query.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(query.startDate);
    }

    if (query.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(query.endDate);
    }

    if (user.role === 'recruiter' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    } else if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    sql += ` GROUP BY channel`;

    const results = await db.query(sql, params);
    return results.map(row => ({
      channel: row.channel,
      outreach: parseInt(row.total_outreach),
      responses: parseInt(row.responses),
      conversions: parseInt(row.conversions)
    }));
  }

  private buildRowLevelFilter(user: User, query: AnalyticsQuery): string {
    // Admins can see all data
    if (user.role === 'admin') {
      return query.facilityId ? `facility_id = '${query.facilityId}'` : '';
    }

    // Recruiters and viewers are limited to their facility
    if (user.facilityId) {
      return `facility_id = '${user.facilityId}'`;
    }

    // Default deny policy
    if (config.governance.rowLevelSecurity.defaultPolicy === 'deny') {
      return '1 = 0';
    }

    return '';
  }

  private generateCacheKey(type: string, query: AnalyticsQuery, user: User, framework?: string): string {
    const queryString = JSON.stringify({
      ...query,
      userRole: user.role,
      facilityId: user.facilityId,
      framework
    });
    return `${this.cachePrefix}${type}:${Buffer.from(queryString).toString('base64')}`;
  }

  private async clearCache(): Promise<void> {
    const client = redis.getClient();
    const keys = await client.keys(`${this.cachePrefix}*`);
    if (keys.length > 0) {
      await client.del(...keys);
    }
  }

  // Wrapper method for getting all KPIs (simplified for alerts/reports)
  async getKPIs(query: AnalyticsQuery): Promise<AnalyticsKPI> {
    // Create a mock user with admin permissions for internal use
    const systemUser: User = {
      id: 'system',
      email: 'system@internal',
      role: 'admin' as any,
      permissions: []
    };

    // Fetch all KPI data
    const pipelineData = await this.getPipelineKPIs(query, systemUser);
    const complianceData = await this.getComplianceMetrics(query, systemUser);
    const revenueData = await this.getRevenueMetrics(query, systemUser);
    const outreachData = await this.getOutreachMetrics(query, systemUser);

    // Aggregate pipeline data (it returns an array)
    const totalApplications = Array.isArray(pipelineData) 
      ? pipelineData.reduce((sum: number, item: any) => sum + (item.total_applications || 0), 0)
      : 0;
    const avgTimeToFill = Array.isArray(pipelineData) && pipelineData.length > 0
      ? pipelineData.reduce((sum: number, item: any) => sum + (item.avg_time_to_fill_days || 0), 0) / pipelineData.length
      : 0;

    // Aggregate compliance data (it returns an array)
    const totalCompliant = Array.isArray(complianceData)
      ? complianceData.reduce((sum: number, item: any) => sum + (item.compliantApplications || 0), 0)
      : 0;
    const totalComplianceApps = Array.isArray(complianceData)
      ? complianceData.reduce((sum: number, item: any) => sum + (item.totalApplications || 0), 0)
      : 0;
    const complianceRate = totalComplianceApps > 0 ? (totalCompliant / totalComplianceApps) * 100 : 0;

    return {
      pipelineCount: totalApplications,
      timeToFill: avgTimeToFill,
      complianceStatus: {
        totalApplications: totalComplianceApps,
        compliantApplications: totalCompliant,
        complianceRate,
        violations: []
      },
      revenue: revenueData,
      outreachEffectiveness: outreachData
    };
  }
}

export const analyticsService = new AnalyticsService();
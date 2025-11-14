import { db } from '../config/database';
import { CompliancePreset, SecurityContext, User, AuditLogEntry, Permission } from '../types';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';

export class GovernanceService {
  private readonly auditTable = 'audit_logs';
  private readonly policiesTable = 'governance_policies';

  async getCompliancePreset(framework: 'hipaa' | 'gdpr' | 'soc2'): Promise<CompliancePreset> {
    return config.governance.compliancePresets[framework];
  }

  async applyCompliancePreset(
    framework: 'hipaa' | 'gdpr' | 'soc2',
    user: User,
    scope?: string
  ): Promise<SecurityContext> {
    const preset = await this.getCompliancePreset(framework);
    
    const securityContext: SecurityContext = {
      user,
      complianceFramework: framework,
      preset,
      auditRequired: preset.auditRequirements.logAllAccess,
      piiAccess: user.permissions.includes('view_pii' as any),
      facilityScope: scope || user.facilityId,
    };

    // Log the preset application if audit is required
    if (securityContext.auditRequired) {
      await this.logGovernanceAction({
        userId: user.id,
        userEmail: user.email,
        userRole: user.role,
        action: 'apply_compliance_preset',
        resource: 'governance',
        resourceId: framework,
        timestamp: new Date(),
        ipAddress: 'system',
        userAgent: 'system',
        facilityId: user.facilityId,
        details: {
          framework,
          preset: preset.name,
          scope,
        },
        success: true,
        complianceFramework: framework,
      });
    }

    return securityContext;
  }

  async validateDataAccess(
    securityContext: SecurityContext,
    resourceType: string,
    resourceId?: string
  ): Promise<{ allowed: boolean; reason?: string; conditions?: any[] }> {
    const { user, preset } = securityContext;

    // Check basic permissions
    const requiredPermission = this.getRequiredPermission(resourceType);
    if (!user.permissions.includes(requiredPermission)) {
      return {
        allowed: false,
        reason: `Missing required permission: ${requiredPermission}`,
      };
    }

    // Check facility scope for non-admin users
    if (user.role !== 'admin' && user.facilityId) {
      // Additional facility validation would be done at query level
    }

    // Check export restrictions
    if (resourceType === 'export' && preset.exportRestrictions.enabled) {
      const conditions = [];
      
      if (preset.exportRestrictions.approvalRequired) {
        conditions.push({
          type: 'approval_required',
          message: 'Export requires administrative approval',
        });
      }

      if (preset.exportRestrictions.maxRecords) {
        conditions.push({
          type: 'limit_restriction',
          maxRecords: preset.exportRestrictions.maxRecords,
        });
      }

      if (conditions.length > 0) {
        return {
          allowed: false,
          reason: 'Export restrictions apply',
          conditions,
        };
      }
    }

    return { allowed: true };
  }

  async getAuditLogs(
    user: User,
    filters: {
      startDate?: Date;
      endDate?: Date;
      userId?: string;
      action?: string;
      resource?: string;
      complianceFramework?: 'hipaa' | 'gdpr' | 'soc2';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ logs: AuditLogEntry[]; total: number }> {
    // Check if user has permission to view audit logs
    if (!user.permissions.includes('view_audit_logs' as any)) {
      throw new Error('Insufficient permissions to view audit logs');
    }

    let whereClause = 'WHERE 1=1';
    const params: any[] = [];
    let paramIndex = 1;

    // Build WHERE clause based on filters
    if (filters.startDate) {
      whereClause += ` AND timestamp >= $${paramIndex++}`;
      params.push(filters.startDate);
    }

    if (filters.endDate) {
      whereClause += ` AND timestamp <= $${paramIndex++}`;
      params.push(filters.endDate);
    }

    if (filters.userId) {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(filters.userId);
    }

    if (filters.action) {
      whereClause += ` AND action = $${paramIndex++}`;
      params.push(filters.action);
    }

    if (filters.resource) {
      whereClause += ` AND resource = $${paramIndex++}`;
      params.push(filters.resource);
    }

    if (filters.complianceFramework) {
      whereClause += ` AND compliance_framework = $${paramIndex++}`;
      params.push(filters.complianceFramework);
    }

    // Non-admin users can only see their own audit logs
    if (user.role !== 'admin') {
      whereClause += ` AND user_id = $${paramIndex++}`;
      params.push(user.id);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM ${this.auditTable} ${whereClause}`;
    const countResult = await db.queryOne(countQuery, params);
    const total = parseInt(countResult.total);

    // Get paginated results
    const limit = filters.limit || 100;
    const offset = filters.offset || 0;
    
    const query = `
      SELECT * FROM ${this.auditTable} 
      ${whereClause}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    
    params.push(limit, offset);
    
    const logs = await db.query(query, params);

    return {
      logs: logs.map(log => ({
        ...log,
        details: typeof log.details === 'string' ? JSON.parse(log.details) : log.details,
      })),
      total,
    };
  }

  async logGovernanceAction(auditEntry: Omit<AuditLogEntry, 'id'>): Promise<void> {
    if (!config.governance.auditLog.enabled) {
      return;
    }

    await db.query(`
      INSERT INTO ${this.auditTable} (
        id, user_id, user_email, user_role, action, resource, resource_id,
        timestamp, ip_address, user_agent, facility_id, details, success,
        error_message, compliance_framework
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15
      )
    `, [
      uuidv4(),
      auditEntry.userId,
      auditEntry.userEmail,
      auditEntry.userRole,
      auditEntry.action,
      auditEntry.resource,
      auditEntry.resourceId,
      auditEntry.timestamp,
      auditEntry.ipAddress,
      auditEntry.userAgent,
      auditEntry.facilityId,
      JSON.stringify(auditEntry.details),
      auditEntry.success,
      auditEntry.errorMessage,
      auditEntry.complianceFramework,
    ]);
  }

  async cleanupExpiredData(): Promise<{ auditLogs: number; metricVersions: number }> {
    const results = { auditLogs: 0, metricVersions: 0 };

    // Cleanup audit logs based on retention policies
    const frameworks: Array<'hipaa' | 'gdpr' | 'soc2'> = ['hipaa', 'gdpr', 'soc2'];
    
    for (const framework of frameworks) {
      const retentionDays = config.governance.auditLog.retention[framework];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const deleteResult = await db.query(`
        DELETE FROM ${this.auditTable} 
        WHERE compliance_framework = $1 AND timestamp < $2
        RETURNING id
      `, [framework, cutoffDate]);

      results.auditLogs += deleteResult.length;
    }

    // Cleanup old metric versions
    const metricRetentionDate = new Date();
    metricRetentionDate.setDate(metricRetentionDate.getDate() - 365); // 1 year for metric versions

    const metricDeleteResult = await db.query(`
      DELETE FROM metric_versions 
      WHERE timestamp < $1
      RETURNING id
    `, [metricRetentionDate]);

    results.metricVersions += metricDeleteResult.length;

    return results;
  }

  async getComplianceReport(
    framework: 'hipaa' | 'gdpr' | 'soc2',
    startDate: Date,
    endDate: Date
  ): Promise<any> {
    const preset = await this.getCompliancePreset(framework);

    // Get audit statistics
    const auditStats = await db.queryOne(`
      SELECT 
        COUNT(*) as total_actions,
        COUNT(*) FILTER (WHERE success = true) as successful_actions,
        COUNT(*) FILTER (WHERE success = false) as failed_actions,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT resource) as unique_resources
      FROM ${this.auditTable}
      WHERE compliance_framework = $1 
        AND timestamp >= $2 
        AND timestamp <= $3
    `, [framework, startDate, endDate]);

    // Get PII access attempts
    const piiAccessStats = await db.queryOne(`
      SELECT 
        COUNT(*) as total_pii_access,
        COUNT(*) FILTER (WHERE success = true) as successful_pii_access,
        COUNT(*) FILTER (WHERE success = false) as denied_pii_access
      FROM ${this.auditTable}
      WHERE compliance_framework = $1 
        AND action LIKE '%pii%'
        AND timestamp >= $2 
        AND timestamp <= $3
    `, [framework, startDate, endDate]);

    // Get export attempts
    const exportStats = await db.queryOne(`
      SELECT 
        COUNT(*) as total_exports,
        COUNT(*) FILTER (WHERE success = true) as successful_exports,
        COUNT(*) FILTER (WHERE success = false) as denied_exports
      FROM ${this.auditTable}
      WHERE compliance_framework = $1 
        AND action LIKE '%export%'
        AND timestamp >= $2 
        AND timestamp <= $3
    `, [framework, startDate, endDate]);

    return {
      framework,
      preset: preset.name,
      period: {
        startDate,
        endDate,
      },
      auditStatistics: auditStats,
      piiAccessStatistics: piiAccessStats,
      exportStatistics: exportStats,
      complianceSettings: {
        dataRetention: preset.dataRetention,
        piiMasking: preset.piiMasking,
        auditRequirements: preset.auditRequirements,
        exportRestrictions: preset.exportRestrictions,
      },
    };
  }

  private getRequiredPermission(resourceType: string): Permission {
    const permissionMap: Record<string, Permission> = {
      'analytics': Permission.VIEW_ANALYTICS,
      'analytics_facility': Permission.VIEW_FACILITY_ANALYTICS,
      'pii': Permission.VIEW_PII,
      'audit_logs': Permission.VIEW_AUDIT_LOGS,
      'governance': Permission.MANAGE_GOVERNANCE,
      'export': Permission.EXPORT_DATA,
      'metrics_versioned': Permission.VIEW_VERSIONED_METRICS,
    };

    return permissionMap[resourceType] || Permission.VIEW_ANALYTICS;
  }

  // Initialize governance tables
  async initializeTables(): Promise<void> {
    // Initialize audit logs table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.auditTable} (
        id UUID PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        user_role VARCHAR(50) NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(100) NOT NULL,
        resource_id VARCHAR(100),
        timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
        ip_address VARCHAR(45) NOT NULL,
        user_agent TEXT,
        facility_id VARCHAR(100),
        details JSONB,
        success BOOLEAN NOT NULL,
        error_message TEXT,
        compliance_framework VARCHAR(20)
      )
    `);

    // Create indexes for audit logs
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id 
      ON ${this.auditTable} (user_id)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp 
      ON ${this.auditTable} (timestamp)
    `);

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_audit_logs_compliance 
      ON ${this.auditTable} (compliance_framework)
    `);

    // Initialize governance policies table
    await db.query(`
      CREATE TABLE IF NOT EXISTS ${this.policiesTable} (
        id UUID PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        framework VARCHAR(20) NOT NULL,
        policy_type VARCHAR(50) NOT NULL,
        config JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        created_by VARCHAR(100) NOT NULL,
        active BOOLEAN NOT NULL DEFAULT true
      )
    `);
  }
}

export const governanceService = new GovernanceService();
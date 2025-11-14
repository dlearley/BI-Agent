import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../config/database';
import { AuthenticatedRequest } from './auth';
import { AuditLogEntry, UserRole, SecurityContext } from '../types';
import config from '../config';

export interface AuditableRequest extends AuthenticatedRequest {
  auditContext?: {
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, any>;
    complianceFramework?: 'hipaa' | 'gdpr' | 'soc2';
  };
}

export const auditLogger = (action: string, resource: string) => {
  return (req: AuditableRequest, res: Response, next: NextFunction): void => {
    if (!config.governance.auditLog.enabled) {
      next();
      return;
    }

    // Store audit context for later logging
    req.auditContext = {
      action,
      resource,
      resourceId: req.params.id || req.params.jobId,
      details: {
        method: req.method,
        url: req.originalUrl,
        query: req.query,
        body: req.method !== 'GET' ? sanitizeRequestBody(req.body) : undefined,
      },
    };

    // Override res.json to capture response
    const originalJson = res.json;
    res.json = function(data: any) {
      // Log the audit entry
      logAuditEntry(req, res, data).catch(error => {
        console.error('Failed to log audit entry:', error);
      });
      
      return originalJson.call(this, data);
    };

    // Override res.status to capture errors
    const originalStatus = res.status;
    res.status = function(code: number) {
      if (code >= 400) {
        logAuditEntry(req, res, null, `HTTP ${code}`).catch(error => {
          console.error('Failed to log audit entry:', error);
        });
      }
      return originalStatus.call(this, code);
    };

    next();
  };
};

export const logAuditEntry = async (
  req: AuditableRequest,
  res: Response,
  responseData: any,
  errorMessage?: string
): Promise<void> => {
  try {
    if (!req.user || !req.auditContext) {
      return;
    }

    const auditEntry: Omit<AuditLogEntry, 'id'> = {
      userId: req.user.id,
      userEmail: req.user.email,
      userRole: req.user.role,
      action: req.auditContext.action,
      resource: req.auditContext.resource,
      resourceId: req.auditContext.resourceId,
      timestamp: new Date(),
      ipAddress: getClientIP(req),
      userAgent: req.get('User-Agent') || 'Unknown',
      facilityId: req.user.facilityId,
      details: {
        ...req.auditContext.details,
        responseStatus: res.statusCode,
        responseData: sanitizeResponseData(responseData),
      },
      success: res.statusCode < 400 && !errorMessage,
      errorMessage,
      complianceFramework: req.auditContext.complianceFramework,
    };

    // Insert into audit log table
    await db.query(`
      INSERT INTO audit_logs (
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

  } catch (error) {
    console.error('Audit logging failed:', error);
    // Don't throw - audit logging failures shouldn't break the main flow
  }
};

export const createSecurityContext = (
  req: AuthenticatedRequest,
  complianceFramework: 'hipaa' | 'gdpr' | 'soc2'
): SecurityContext => {
  const user = req.user!;
  const preset = config.governance.compliancePresets[complianceFramework];
  
  return {
    user,
    complianceFramework,
    preset,
    auditRequired: preset.auditRequirements.logAllAccess,
    piiAccess: user.permissions.includes('view_pii' as any),
    facilityScope: user.facilityId,
  };
};

const getClientIP = (req: Request): string => {
  return (
    req.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    req.get('X-Real-IP') ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') {
    return body;
  }

  const sanitized = { ...body };
  const sensitiveFields = config.governance.auditLog.sensitiveFields;
  
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
};

const sanitizeResponseData = (data: any): any => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  // For response data, we'll just flag if it contains sensitive info
  const sensitiveFields = config.governance.auditLog.sensitiveFields;
  const containsSensitive = sensitiveFields.some(field => 
    JSON.stringify(data).toLowerCase().includes(field.toLowerCase())
  );

  if (containsSensitive) {
    return '[CONTAINS_SENSITIVE_DATA]';
  }

  return data;
};

// Cleanup old audit logs based on retention policies
export const cleanupAuditLogs = async (): Promise<void> => {
  try {
    const frameworks: Array<'hipaa' | 'gdpr' | 'soc2'> = ['hipaa', 'gdpr', 'soc2'];
    
    for (const framework of frameworks) {
      const retentionDays = config.governance.auditLog.retention[framework];
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      await db.query(`
        DELETE FROM audit_logs 
        WHERE compliance_framework = $1 AND timestamp < $2
      `, [framework, cutoffDate]);
    }
  } catch (error) {
    console.error('Failed to cleanup audit logs:', error);
  }
};
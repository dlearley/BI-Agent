import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { SecurityContext, User, UserRole, Permission } from '../types';
import { db } from '../config/database';
import config from '../config';

export interface SecureRequest extends AuthenticatedRequest {
  securityContext?: SecurityContext;
  rowLevelFilter?: string;
  columnLevelFilter?: string[];
}

export const enhancedRBAC = (requiredPermissions: Permission[], complianceFramework: 'hipaa' | 'gdpr' | 'soc2' = 'hipaa') => {
  return async (req: SecureRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Check if user has required permissions
      const hasPermission = requiredPermissions.every(permission =>
        req.user!.permissions.includes(permission)
      );

      if (!hasPermission) {
        res.status(403).json({ 
          error: 'Insufficient permissions',
          required: requiredPermissions,
          current: req.user.permissions
        });
        return;
      }

      // Create security context
      const securityContext = createSecurityContext(req.user, complianceFramework);
      req.securityContext = securityContext;

      // Apply row-level security
      if (config.governance.rowLevelSecurity.enabled) {
        req.rowLevelFilter = buildRowLevelFilter(securityContext);
      }

      // Apply column-level security
      if (config.governance.columnLevelSecurity.enabled) {
        req.columnLevelFilter = buildColumnLevelFilter(securityContext);
      }

      next();
    } catch (error) {
      console.error('RBAC error:', error);
      res.status(500).json({ error: 'Authorization check failed' });
    }
  };
};

export const facilityDataFilter = (req: SecureRequest, res: Response, next: NextFunction): void => {
  if (!req.user || !req.securityContext) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { user, securityContext } = req;

  // Admins can see all facilities
  if (user.role === UserRole.ADMIN) {
    next();
    return;
  }

  // Recruiters and viewers can only see their facility
  if (!user.facilityId) {
    res.status(403).json({ error: 'User must be assigned to a facility' });
    return;
  }

  // Add facility filter to request for use in queries
  req.rowLevelFilter = `facility_id = '${user.facilityId}'`;
  next();
};

export const dataExportRestrictions = (req: SecureRequest, res: Response, next: NextFunction): void => {
  if (!req.securityContext) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { preset } = req.securityContext;

  if (!preset.exportRestrictions.enabled) {
    next();
    return;
  }

  // Check export permissions
  const hasExportPermission = req.user!.permissions.includes(Permission.EXPORT_DATA);
  if (!hasExportPermission) {
    res.status(403).json({ error: 'Export permission required' });
    return;
  }

  // Check approval requirement
  if (preset.exportRestrictions.approvalRequired) {
    res.status(402).json({ 
      error: 'Export approval required',
      message: 'Please contact your administrator for export approval'
    });
    return;
  }

  // Check record limit
  const requestedLimit = parseInt(req.query.limit as string) || 1000;
  if (requestedLimit > preset.exportRestrictions.maxRecords) {
    res.status(400).json({ 
      error: 'Export limit exceeded',
      maxAllowed: preset.exportRestrictions.maxRecords,
      requested: requestedLimit
    });
    return;
  }

  next();
};

const createSecurityContext = (user: User, complianceFramework: 'hipaa' | 'gdpr' | 'soc2'): SecurityContext => {
  const preset = config.governance.compliancePresets[complianceFramework];
  
  return {
    user,
    complianceFramework,
    preset,
    auditRequired: preset.auditRequirements.logAllAccess,
    piiAccess: user.permissions.includes(Permission.VIEW_PII),
    facilityScope: user.facilityId,
  };
};

const buildRowLevelFilter = (securityContext: SecurityContext): string => {
  const { user } = securityContext;
  
  // Admins can see all data
  if (user.role === UserRole.ADMIN) {
    return '';
  }

  // Non-admin users are filtered by facility
  if (user.facilityId) {
    return `facility_id = '${user.facilityId}'`;
  }

  // Default deny policy
  if (config.governance.rowLevelSecurity.defaultPolicy === 'deny') {
    return '1 = 0'; // Always false, no rows returned
  }

  return ''; // Allow all (default allow policy)
};

const buildColumnLevelFilter = (securityContext: SecurityContext): string[] => {
  const { preset, piiAccess } = securityContext;
  const allowedColumns: string[] = [];

  // Start with all non-PII columns
  const restrictedColumns = new Set([
    ...config.governance.columnLevelSecurity.piiColumns,
    ...config.governance.columnLevelSecurity.restrictedColumns,
  ]);

  // If user has PII access, allow PII columns based on preset
  if (piiAccess && preset.piiMasking.enabled) {
    // Allow PII columns based on masking strategy
    if (preset.piiMasking.maskingStrategy === 'full') {
      // Full access to PII columns
      config.governance.columnLevelSecurity.piiColumns.forEach(col => restrictedColumns.delete(col));
      config.governance.columnLevelSecurity.restrictedColumns.forEach(col => restrictedColumns.add(col));
    } else if (preset.piiMasking.maskingStrategy === 'partial') {
      // Partial access - some PII fields allowed
      const partialPII = preset.piiMasking.fields.slice(0, Math.ceil(preset.piiMasking.fields.length / 2));
      partialPII.forEach(col => restrictedColumns.delete(col));
    }
    // Hash strategy means no direct access to PII columns
  }

  return Array.from(restrictedColumns);
};

export const applyColumnLevelSecurity = (data: any[], restrictedColumns: string[]): any[] => {
  if (!restrictedColumns.length) {
    return data;
  }

  return data.map(row => {
    const filteredRow = { ...row };
    
    for (const column of restrictedColumns) {
      if (column in filteredRow) {
        delete filteredRow[column];
      }
    }
    
    return filteredRow;
  });
};

export const applyRowLevelSecurity = (sql: string, rowFilter?: string): string => {
  if (!rowFilter) {
    return sql;
  }

  // Find WHERE clause and add row filter
  const whereRegex = /\bWHERE\b/i;
  const hasWhere = whereRegex.test(sql);
  
  if (hasWhere) {
    return sql.replace(/\bWHERE\b/i, `WHERE ${rowFilter} AND`);
  } else {
    // Find the last FROM clause to add WHERE
    const fromMatch = sql.match(/\bFROM\s+\w+.*?(?=\s+(GROUP BY|ORDER BY|LIMIT|HAVING|$))/i);
    if (fromMatch) {
      return sql.replace(fromMatch[0], `${fromMatch[0]} WHERE ${rowFilter}`);
    }
  }
  
  return sql;
};
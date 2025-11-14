import { Request, Response } from 'express';
import { governanceService } from '../services/governance.service';
import { metricVersioningService } from '../services/metric-versioning.service';
import { piiMaskingService } from '../services/pii-masking.service';
import { analyticsService } from '../services/analytics.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';
import { SecurityContext } from '../types';

const auditLogQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
  action: z.string().optional(),
  resource: z.string().optional(),
  complianceFramework: z.enum(['hipaa', 'gdpr', 'soc2']).optional(),
  limit: z.string().transform(Number).optional(),
  offset: z.string().transform(Number).optional(),
});

const applyPresetSchema = z.object({
  scope: z.string().optional(),
});

const exportDataSchema = z.object({
  format: z.enum(['json', 'csv']).default('json'),
  filters: z.record(z.any()).optional(),
  limit: z.number().max(10000).default(1000),
});

const validatePIISchema = z.object({
  originalData: z.any(),
  maskedData: z.any(),
  framework: z.enum(['hipaa', 'gdpr', 'soc2']),
});

const validateAccessSchema = z.object({
  resourceType: z.string(),
  resourceId: z.string().optional(),
  framework: z.enum(['hipaa', 'gdpr', 'soc2']),
});

export class GovernanceController {
  async getAuditLogs(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const query = auditLogQuerySchema.parse(req.query);
      const user = req.user!;

      const filters = {
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
        userId: query.userId,
        action: query.action,
        resource: query.resource,
        complianceFramework: query.complianceFramework,
        limit: query.limit,
        offset: query.offset,
      };

      const result = await governanceService.getAuditLogs(user, filters);
      
      res.json({
        success: true,
        data: result.logs,
        pagination: {
          total: result.total,
          limit: filters.limit,
          offset: filters.offset,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch audit logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getCompliancePreset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { framework } = req.params;
      const preset = await governanceService.getCompliancePreset(framework as any);
      
      res.json({
        success: true,
        data: preset,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching compliance preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch compliance preset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async applyCompliancePreset(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { framework } = req.params;
      const { scope } = applyPresetSchema.parse(req.body);
      const user = req.user!;

      const securityContext = await governanceService.applyCompliancePreset(
        framework as any,
        user,
        scope
      );
      
      res.json({
        success: true,
        data: {
          framework,
          securityContext: {
            complianceFramework: securityContext.complianceFramework,
            preset: securityContext.preset.name,
            auditRequired: securityContext.auditRequired,
            piiAccess: securityContext.piiAccess,
            facilityScope: securityContext.facilityScope,
          },
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error applying compliance preset:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply compliance preset',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getMetricVersions(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { metricType, metricId } = req.params;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;

      const versions = await metricVersioningService.getVersionHistory(metricType, metricId, limit);
      
      res.json({
        success: true,
        data: versions,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching metric versions:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metric versions',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getMetricVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { metricType, metricId, version } = req.params;
      const versionNum = parseInt(version);

      const metricVersion = await metricVersioningService.getVersion(metricType, metricId, versionNum);
      
      if (!metricVersion) {
        res.status(404).json({
          success: false,
          error: 'Metric version not found',
        });
        return;
      }

      res.json({
        success: true,
        data: metricVersion,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching metric version:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch metric version',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async restoreMetricVersion(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { metricType, metricId, version } = req.params;
      const versionNum = parseInt(version);
      const user = req.user!;

      const restoredVersion = await metricVersioningService.restoreVersion(
        metricType,
        metricId,
        versionNum,
        user
      );
      
      res.json({
        success: true,
        data: restoredVersion,
        message: `Successfully restored version ${versionNum}`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error restoring metric version:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to restore metric version',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getVersioningStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const status = await metricVersioningService.getMetricsByVersioningStatus();
      
      res.json({
        success: true,
        data: status,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error fetching versioning status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch versioning status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async exportData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { resourceType } = req.params;
      const { format, filters, limit } = exportDataSchema.parse(req.body);
      const user = req.user!;

      let data: any[];
      
      // Get data based on resource type
      switch (resourceType) {
        case 'analytics':
          data = await analyticsService.getCombinedKPIs(filters || {}, user);
          break;
        case 'pipeline':
          data = await analyticsService.getPipelineKPIs(filters || {}, user);
          break;
        case 'compliance':
          data = await analyticsService.getComplianceMetrics(filters || {}, user);
          break;
        case 'revenue': {
          const revenueData = await analyticsService.getRevenueMetrics(filters || {}, user);
          data = Array.isArray(revenueData) ? revenueData : [revenueData];
          break;
        }
        case 'outreach': {
          const outreachData = await analyticsService.getOutreachMetrics(filters || {}, user);
          data = Array.isArray(outreachData) ? outreachData : [outreachData];
          break;
        }
        default:
          res.status(400).json({
            success: false,
            error: 'Invalid resource type',
          });
          return;
      }

      // Apply data limit
      if (Array.isArray(data) && data.length > limit) {
        data = data.slice(0, limit);
      }

      // Format response based on requested format
      if (format === 'csv') {
        // Simple CSV conversion (would need more sophisticated implementation for complex objects)
        const csv = this.convertToCSV(data);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${resourceType}_export_${Date.now()}.csv"`);
        res.send(csv);
      } else {
        res.json({
          success: true,
          data,
          metadata: {
            resourceType,
            exportFormat: format,
            recordCount: Array.isArray(data) ? data.length : 1,
            exportedBy: user.email,
            exportTimestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error('Error exporting data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to export data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getComplianceReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { framework } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required',
        });
        return;
      }

      const report = await governanceService.getComplianceReport(
        framework as any,
        new Date(startDate as string),
        new Date(endDate as string)
      );
      
      res.json({
        success: true,
        data: report,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error generating compliance report:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async cleanupExpiredData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const results = await governanceService.cleanupExpiredData();
      
      res.json({
        success: true,
        data: results,
        message: `Cleaned up ${results.auditLogs} audit logs and ${results.metricVersions} metric versions`,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error cleaning up expired data:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cleanup expired data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async validatePIIMasking(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { originalData, maskedData, framework } = validatePIISchema.parse(req.body);
      const user = req.user!;

      const securityContext = await governanceService.applyCompliancePreset(framework, user);
      const isValid = piiMaskingService.validatePIIMasking(originalData, maskedData, securityContext);
      
      res.json({
        success: true,
        data: {
          isValid,
          framework,
          maskingStrategy: securityContext.preset.piiMasking.maskingStrategy,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error validating PII masking:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate PII masking',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async validateDataAccess(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { resourceType, resourceId, framework } = validateAccessSchema.parse(req.body);
      const user = req.user!;

      const securityContext = await governanceService.applyCompliancePreset(framework, user);
      const validation = await governanceService.validateDataAccess(securityContext, resourceType, resourceId);
      
      res.json({
        success: true,
        data: validation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error('Error validating data access:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate data access',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private convertToCSV(data: any[]): string {
    if (!Array.isArray(data) || data.length === 0) {
      return '';
    }

    // Get headers from first object
    const headers = Object.keys(data[0]);
    const csvRows = [headers.join(',')];

    // Convert each row to CSV
    for (const row of data) {
      const values = headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) {
          return '';
        }
        // Escape quotes and wrap in quotes if contains comma or quote
        const stringValue = String(value);
        if (stringValue.includes(',') || stringValue.includes('"')) {
          return `"${stringValue.replace(/"/g, '""')}"`;
        }
        return stringValue;
      });
      csvRows.push(values.join(','));
    }

    return csvRows.join('\n');
  }
}

export const governanceController = new GovernanceController();
import { Router } from 'express';
import { governanceController } from '../controllers/governance.controller';
import { authenticate, authorize } from '../middleware/auth';
import { enhancedRBAC, dataExportRestrictions } from '../middleware/rbac';
import { auditLogger } from '../middleware/audit';
import { Permission } from '../types';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

// Audit Logs
router.get(
  '/audit-logs',
  auditLogger('view_audit_logs', 'governance'),
  enhancedRBAC([Permission.VIEW_AUDIT_LOGS]),
  governanceController.getAuditLogs.bind(governanceController)
);

// Compliance Presets
router.get(
  '/presets/:framework',
  auditLogger('view_compliance_preset', 'governance'),
  enhancedRBAC([Permission.VIEW_ANALYTICS]),
  governanceController.getCompliancePreset.bind(governanceController)
);

router.post(
  '/presets/:framework/apply',
  auditLogger('apply_compliance_preset', 'governance'),
  enhancedRBAC([Permission.MANAGE_GOVERNANCE]),
  governanceController.applyCompliancePreset.bind(governanceController)
);

// Metric Versioning
router.get(
  '/metrics/:metricType/:metricId/versions',
  auditLogger('view_metric_versions', 'governance'),
  enhancedRBAC([Permission.VIEW_VERSIONED_METRICS]),
  governanceController.getMetricVersions.bind(governanceController)
);

router.get(
  '/metrics/:metricType/:metricId/versions/:version',
  auditLogger('view_metric_version', 'governance'),
  enhancedRBAC([Permission.VIEW_VERSIONED_METRICS]),
  governanceController.getMetricVersion.bind(governanceController)
);

router.post(
  '/metrics/:metricType/:metricId/versions/:version/restore',
  auditLogger('restore_metric_version', 'governance'),
  enhancedRBAC([Permission.MANAGE_ANALYTICS]),
  governanceController.restoreMetricVersion.bind(governanceController)
);

router.get(
  '/metrics/versions/status',
  auditLogger('view_versioning_status', 'governance'),
  enhancedRBAC([Permission.VIEW_VERSIONED_METRICS]),
  governanceController.getVersioningStatus.bind(governanceController)
);

// Data Export (with restrictions)
router.post(
  '/export/:resourceType',
  auditLogger('export_data', 'governance'),
  enhancedRBAC([Permission.EXPORT_DATA]),
  dataExportRestrictions,
  governanceController.exportData.bind(governanceController)
);

// Compliance Reports
router.get(
  '/reports/:framework',
  auditLogger('view_compliance_report', 'governance'),
  enhancedRBAC([Permission.VIEW_AUDIT_LOGS]),
  governanceController.getComplianceReport.bind(governanceController)
);

// Admin-only governance management
router.use(authorize([Permission.MANAGE_GOVERNANCE]));

// Cleanup expired data
router.post(
  '/cleanup',
  auditLogger('cleanup_expired_data', 'governance'),
  governanceController.cleanupExpiredData.bind(governanceController)
);

// Security validation
router.post(
  '/validate-pii-masking',
  auditLogger('validate_pii_masking', 'governance'),
  governanceController.validatePIIMasking.bind(governanceController)
);

router.post(
  '/validate-access',
  auditLogger('validate_data_access', 'governance'),
  governanceController.validateDataAccess.bind(governanceController)
);

export default router;
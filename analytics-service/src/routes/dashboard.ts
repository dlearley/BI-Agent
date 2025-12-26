import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorize, facilityScope } from '../middleware/auth';
import { hipaaCompliance } from '../middleware/hipaa';
import { enhancedRBAC, dataExportRestrictions } from '../middleware/rbac';
import { Permission, UserRole } from '../types';

const router = Router();

// Apply authentication and HIPAA middleware to all routes
router.use(authenticate);
router.use(hipaaCompliance);
router.use(facilityScope);

// Dashboard data endpoints
router.get(
  '/',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getDashboardData.bind(dashboardController)
);

// Pipeline dashboard
router.get(
  '/pipeline',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getDashboardData.bind(dashboardController)
);

// Revenue dashboard
router.get(
  '/revenue',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getDashboardData.bind(dashboardController)
);

// Compliance dashboard
router.get(
  '/compliance',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getDashboardData.bind(dashboardController)
);

// Outreach dashboard
router.get(
  '/outreach',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getDashboardData.bind(dashboardController)
);

// Combined dashboard
router.get(
  '/combined',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getDashboardData.bind(dashboardController)
);

// Saved Views endpoints
router.get(
  '/views',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getSavedViews.bind(dashboardController)
);

router.post(
  '/views',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.MANAGE_ANALYTICS]),
  dashboardController.createSavedView.bind(dashboardController)
);

router.put(
  '/views/:id',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.MANAGE_ANALYTICS]),
  dashboardController.updateSavedView.bind(dashboardController)
);

router.delete(
  '/views/:id',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.MANAGE_ANALYTICS]),
  dashboardController.deleteSavedView.bind(dashboardController)
);

// Drilldown configurations
router.get(
  '/drilldowns',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  dashboardController.getDrilldownConfigs.bind(dashboardController)
);

router.post(
  '/drilldowns',
  enhancedRBAC([Permission.VIEW_ANALYTICS, Permission.MANAGE_ANALYTICS]),
  dashboardController.createDrilldownConfig.bind(dashboardController)
);

// Export endpoints
router.post(
  '/export',
  dataExportRestrictions,
  enhancedRBAC([Permission.EXPORT_DATA]),
  dashboardController.createExportJob.bind(dashboardController)
);

router.get(
  '/export/jobs',
  enhancedRBAC([Permission.EXPORT_DATA]),
  dashboardController.getExportJobs.bind(dashboardController)
);

router.get(
  '/export/jobs/:jobId',
  enhancedRBAC([Permission.EXPORT_DATA]),
  dashboardController.getExportJob.bind(dashboardController)
);

router.get(
  '/export/download/:jobId',
  enhancedRBAC([Permission.EXPORT_DATA]),
  dashboardController.downloadExport.bind(dashboardController)
);

// Admin-only endpoints
router.use((req, res, next) => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
});

// Admin dashboard management
router.get(
  '/admin/views/all',
  dashboardController.getSavedViews.bind(dashboardController)
);

router.get(
  '/admin/export/all',
  dashboardController.getExportJobs.bind(dashboardController)
);

export default router;
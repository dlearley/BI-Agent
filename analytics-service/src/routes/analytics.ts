import { Router } from 'express';
import { analyticsController } from '../controllers/analytics.controller';
import { authenticate, authorize, facilityScope } from '../middleware/auth';
import { hipaaCompliance } from '../middleware/hipaa';
import { Permission, UserRole } from '../types';

const router = Router();

// Apply authentication and HIPAA middleware to all routes
router.use(authenticate);
router.use(hipaaCompliance);
router.use(facilityScope);

// Pipeline Analytics
router.get(
  '/pipeline',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  analyticsController.getPipelineKPIs.bind(analyticsController)
);

// Compliance Analytics
router.get(
  '/compliance',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  analyticsController.getComplianceMetrics.bind(analyticsController)
);

// Revenue Analytics
router.get(
  '/revenue',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  analyticsController.getRevenueMetrics.bind(analyticsController)
);

// Outreach Analytics
router.get(
  '/outreach',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  analyticsController.getOutreachMetrics.bind(analyticsController)
);

// Combined KPIs
router.get(
  '/kpis',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  analyticsController.getCombinedKPIs.bind(analyticsController)
);

// Analytics Health Check
router.get(
  '/health',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  analyticsController.getAnalyticsHealth.bind(analyticsController)
);

// Last Refresh Times
router.get(
  '/refresh/times',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  analyticsController.getLastRefreshTimes.bind(analyticsController)
);

// Admin-only routes
router.use(requireRole([UserRole.ADMIN]));

// Refresh Analytics (Admin only)
router.post(
  '/refresh',
  authorize([Permission.MANAGE_ANALYTICS]),
  analyticsController.refreshAnalytics.bind(analyticsController)
);

// Get Refresh Job Status (Admin only)
router.get(
  '/refresh/:jobId',
  authorize([Permission.MANAGE_ANALYTICS]),
  analyticsController.getRefreshStatus.bind(analyticsController)
);

// Queue Statistics (Admin only)
router.get(
  '/queue/stats',
  authorize([Permission.MANAGE_ANALYTICS]),
  analyticsController.getQueueStats.bind(analyticsController)
);

// Helper function for role requirement
function requireRole(roles: UserRole[]) {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient role privileges' });
    }

    next();
  };
}

export default router;
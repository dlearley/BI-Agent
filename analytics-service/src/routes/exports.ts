import { Router } from 'express';
import { exportController } from '../controllers/export.controller';
import { authenticate, authorize, facilityScope } from '../middleware/auth';
import { hipaaCompliance } from '../middleware/hipaa';
import { Permission, UserRole } from '../types';

const router = Router();

// Apply authentication and HIPAA middleware to all routes
router.use(authenticate);
router.use(hipaaCompliance);
router.use(facilityScope);

// Export Schedules
router.get(
  '/schedules',
  authorize([Permission.MANAGE_EXPORTS, Permission.EXPORT_DATA]),
  exportController.getExportSchedules.bind(exportController)
);

router.get(
  '/schedules/:id',
  authorize([Permission.MANAGE_EXPORTS, Permission.EXPORT_DATA]),
  exportController.getExportSchedule.bind(exportController)
);

router.post(
  '/schedules',
  authorize([Permission.MANAGE_EXPORTS]),
  exportController.createExportSchedule.bind(exportController)
);

router.put(
  '/schedules/:id',
  authorize([Permission.MANAGE_EXPORTS]),
  exportController.updateExportSchedule.bind(exportController)
);

router.delete(
  '/schedules/:id',
  authorize([Permission.MANAGE_EXPORTS]),
  exportController.deleteExportSchedule.bind(exportController)
);

// Export Jobs
router.get(
  '/jobs',
  authorize([Permission.MANAGE_EXPORTS, Permission.EXPORT_DATA]),
  exportController.getExportJobs.bind(exportController)
);

router.get(
  '/jobs/:id',
  authorize([Permission.MANAGE_EXPORTS, Permission.EXPORT_DATA]),
  exportController.getExportJob.bind(exportController)
);

router.post(
  '/jobs',
  authorize([Permission.MANAGE_EXPORTS, Permission.EXPORT_DATA]),
  exportController.createExportJob.bind(exportController)
);

router.get(
  '/jobs/:id/status',
  authorize([Permission.MANAGE_EXPORTS, Permission.EXPORT_DATA]),
  exportController.getExportJobStatus.bind(exportController)
);

router.get(
  '/jobs/:id/download',
  authorize([Permission.MANAGE_EXPORTS, Permission.EXPORT_DATA]),
  exportController.downloadExportFile.bind(exportController)
);

router.post(
  '/jobs/:id/retry',
  authorize([Permission.MANAGE_EXPORTS]),
  exportController.retryExportJob.bind(exportController)
);

router.post(
  '/jobs/:id/cancel',
  authorize([Permission.MANAGE_EXPORTS]),
  exportController.cancelExportJob.bind(exportController)
);

// Queue Management (Admin only)
router.use(requireRole([UserRole.ADMIN]));

router.get(
  '/queue/stats',
  authorize([Permission.MANAGE_EXPORTS]),
  exportController.getExportQueueStats.bind(exportController)
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
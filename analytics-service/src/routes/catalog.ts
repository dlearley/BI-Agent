import { Router } from 'express';
import { catalogController } from '../controllers/catalog.controller';
import { authenticate, authorize } from '../middleware/auth';
import { hipaaCompliance } from '../middleware/hipaa';
import { Permission, UserRole } from '../types';

const router = Router();

// Apply authentication and HIPAA middleware to all routes
router.use(authenticate);
router.use(hipaaCompliance);

// Public routes (view-only)
router.get(
  '/schemas',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  catalogController.getSchemas.bind(catalogController)
);

router.get(
  '/schemas/:datasetId',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  catalogController.getSchemaDetail.bind(catalogController)
);

router.get(
  '/columns',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  catalogController.getColumns.bind(catalogController)
);

router.get(
  '/freshness',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  catalogController.getFreshness.bind(catalogController)
);

router.get(
  '/lineage/:columnId',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  catalogController.getLineage.bind(catalogController)
);

// Admin-only routes
router.use(requireRole([UserRole.ADMIN]));

// Discovery and profiling
router.post(
  '/discovery',
  authorize([Permission.MANAGE_ANALYTICS]),
  catalogController.initiateDiscovery.bind(catalogController)
);

router.post(
  '/profile',
  authorize([Permission.MANAGE_ANALYTICS]),
  catalogController.requestProfiling.bind(catalogController)
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

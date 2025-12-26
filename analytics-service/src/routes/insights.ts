import { Router } from 'express';
import { insightsController } from '../controllers/insights.controller';
import { authenticate, authorize, facilityScope } from '../middleware/auth';
import { hipaaCompliance } from '../middleware/hipaa';
import { Permission } from '../types';

const router: Router = Router();

router.use(authenticate);
router.use(hipaaCompliance);
router.use(facilityScope);

router.get(
  '/',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  insightsController.getInsights.bind(insightsController)
);

router.get(
  '/:reportId',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  insightsController.getReport.bind(insightsController)
);

router.post(
  '/ml/anomaly-detect',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  insightsController.detectAnomalies.bind(insightsController)
);

router.post(
  '/ml/drivers',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  insightsController.analyzeDrivers.bind(insightsController)
);

export default router;

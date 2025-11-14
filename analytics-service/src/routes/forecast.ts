import { Router } from 'express';
import { forecastController } from '../controllers/forecast.controller';
import { authenticate, authorize, facilityScope } from '../middleware/auth';
import { hipaaCompliance } from '../middleware/hipaa';
import { Permission } from '../types';

const router = Router();

// Apply authentication and HIPAA middleware to all routes
router.use(authenticate);
router.use(hipaaCompliance);
router.use(facilityScope);

// Create new forecast
router.post(
  '/',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  forecastController.createForecast.bind(forecastController)
);

// Get specific forecast
router.get(
  '/:forecastId',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  forecastController.getForecast.bind(forecastController)
);

// Create forecast scenario
router.post(
  '/scenarios',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  forecastController.createScenario.bind(forecastController)
);

// Get user's forecast scenarios
router.get(
  '/scenarios/list',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  forecastController.getScenarios.bind(forecastController)
);

// Get available forecast metrics
router.get(
  '/metrics/available',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  forecastController.getAvailableMetrics.bind(forecastController)
);

// Get available forecast models
router.get(
  '/models/available',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  forecastController.getAvailableModels.bind(forecastController)
);

export default router;
import { Router } from 'express';
import { datasourceController } from '../controllers/datasource.controller';
import { authenticate, authorize } from '../middleware/auth';
import { Permission } from '../types';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Create data source
router.post(
  '/',
  authorize([Permission.MANAGE_ANALYTICS]),
  datasourceController.createDataSource.bind(datasourceController)
);

// List data sources
router.get(
  '/',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  datasourceController.listDataSources.bind(datasourceController)
);

// Get data source
router.get(
  '/:id',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  datasourceController.getDataSource.bind(datasourceController)
);

// Update data source
router.put(
  '/:id',
  authorize([Permission.MANAGE_ANALYTICS]),
  datasourceController.updateDataSource.bind(datasourceController)
);

// Delete data source
router.delete(
  '/:id',
  authorize([Permission.MANAGE_ANALYTICS]),
  datasourceController.deleteDataSource.bind(datasourceController)
);

// Test connection
router.post(
  '/:id/test',
  authorize([Permission.MANAGE_ANALYTICS]),
  datasourceController.testConnection.bind(datasourceController)
);

// Discover schema
router.post(
  '/:id/discover',
  authorize([Permission.MANAGE_ANALYTICS]),
  datasourceController.discoverSchema.bind(datasourceController)
);

// Get samples
router.get(
  '/:id/samples',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  datasourceController.getSamples.bind(datasourceController)
);

// Profile columns
router.get(
  '/:id/profiles',
  authorize([Permission.VIEW_ANALYTICS, Permission.VIEW_FACILITY_ANALYTICS]),
  datasourceController.profileColumns.bind(datasourceController)
);

export default router;

import { Router } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authenticate, authorize, requireRole } from '../middleware/auth';
import { Permission, UserRole } from '../types';

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticate);

// Dashboard routes
router.post('/dashboards', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.createDashboard.bind(dashboardController)
);

router.get('/dashboards', 
  authorize([Permission.VIEW_DASHBOARDS]), 
  dashboardController.getDashboards.bind(dashboardController)
);

router.get('/dashboards/:id', 
  authorize([Permission.VIEW_DASHBOARDS]), 
  dashboardController.getDashboard.bind(dashboardController)
);

router.put('/dashboards/:id', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.updateDashboard.bind(dashboardController)
);

router.delete('/dashboards/:id', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.deleteDashboard.bind(dashboardController)
);

router.post('/dashboards/:id/publish', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.publishDashboard.bind(dashboardController)
);

// Widget routes
router.post('/widgets', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.createWidget.bind(dashboardController)
);

router.get('/widgets/:id', 
  authorize([Permission.VIEW_DASHBOARDS]), 
  dashboardController.getWidget.bind(dashboardController)
);

router.put('/widgets/:id', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.updateWidget.bind(dashboardController)
);

router.delete('/widgets/:id', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.deleteWidget.bind(dashboardController)
);

// Query routes
router.post('/queries', 
  authorize([Permission.MANAGE_DASHBOARDS]), 
  dashboardController.createQuery.bind(dashboardController)
);

router.get('/queries', 
  authorize([Permission.VIEW_DASHBOARDS]), 
  dashboardController.getQueries.bind(dashboardController)
);

router.get('/queries/:id', 
  authorize([Permission.VIEW_DASHBOARDS]), 
  dashboardController.getQuery.bind(dashboardController)
);

// Widget data route
router.post('/widgets/data', 
  authorize([Permission.VIEW_DASHBOARDS]), 
  dashboardController.getWidgetData.bind(dashboardController)
);

// Export routes
router.post('/exports', 
  authorize([Permission.EXPORT_DATA]), 
  dashboardController.createExportJob.bind(dashboardController)
);

router.get('/exports/:id', 
  authorize([Permission.EXPORT_DATA]), 
  dashboardController.getExportJob.bind(dashboardController)
);

router.get('/dashboards/:dashboardId/exports', 
  authorize([Permission.EXPORT_DATA]), 
  dashboardController.getExportJobs.bind(dashboardController)
);

// Sharing routes
router.post('/dashboards/:dashboardId/share', 
  authorize([Permission.SHARE_DASHBOARDS]), 
  dashboardController.shareDashboard.bind(dashboardController)
);

router.delete('/dashboards/:dashboardId/share/:userId', 
  authorize([Permission.SHARE_DASHBOARDS]), 
  dashboardController.unshareDashboard.bind(dashboardController)
);

export default router;
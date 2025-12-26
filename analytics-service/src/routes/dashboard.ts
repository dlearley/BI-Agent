import { Router, Request, Response } from 'express';
import { dashboardController } from '../controllers/dashboard.controller';
import { authMiddleware } from '../middleware/auth';

const router: Router = Router();

// Apply authentication middleware
router.use(authMiddleware);

// ==================== Dashboards ====================
router.get('/:organizationId/dashboards', (req: Request, res: Response) => 
  dashboardController.listDashboards(req as any, res)
);

router.post('/:organizationId/dashboards', (req: Request, res: Response) => 
  dashboardController.createDashboard(req as any, res)
);

router.get('/:organizationId/dashboards/:dashboardId', (req: Request, res: Response) => 
  dashboardController.getDashboard(req as any, res)
);

router.patch('/:organizationId/dashboards/:dashboardId', (req: Request, res: Response) => 
  dashboardController.updateDashboard(req as any, res)
);

router.delete('/:organizationId/dashboards/:dashboardId', (req: Request, res: Response) => 
  dashboardController.deleteDashboard(req as any, res)
);

// ==================== Dashboard Widgets ====================
router.post('/:organizationId/dashboards/:dashboardId/widgets', (req: Request, res: Response) => 
  dashboardController.addWidget(req as any, res)
);

router.patch('/:organizationId/dashboards/widgets/:widgetId', (req: Request, res: Response) => 
  dashboardController.updateWidget(req as any, res)
);

router.delete('/:organizationId/dashboards/widgets/:widgetId', (req: Request, res: Response) => 
  dashboardController.removeWidget(req as any, res)
);

// ==================== Dashboard Filters ====================
router.post('/:organizationId/dashboards/:dashboardId/filters', (req: Request, res: Response) => 
  dashboardController.addFilter(req as any, res)
);

router.delete('/:organizationId/dashboards/filters/:filterId', (req: Request, res: Response) => 
  dashboardController.removeFilter(req as any, res)
);

// ==================== Data Connectors ====================
router.get('/:organizationId/connectors', (req: Request, res: Response) => 
  dashboardController.listDataConnectors(req as any, res)
);

router.post('/:organizationId/connectors', (req: Request, res: Response) => 
  dashboardController.createDataConnector(req as any, res)
);

router.get('/:organizationId/connectors/:connectorId', (req: Request, res: Response) => 
  dashboardController.getDataConnector(req as any, res)
);

router.patch('/:organizationId/connectors/:connectorId', (req: Request, res: Response) => 
  dashboardController.updateDataConnector(req as any, res)
);

router.delete('/:organizationId/connectors/:connectorId', (req: Request, res: Response) => 
  dashboardController.deleteDataConnector(req as any, res)
);

router.post('/:organizationId/connectors/:connectorId/test', (req: Request, res: Response) => 
  dashboardController.testDataConnector(req as any, res)
);

router.get('/:organizationId/connectors/:connectorId/schema', (req: Request, res: Response) => 
  dashboardController.getConnectorSchema(req as any, res)
);

// ==================== Saved Queries ====================
router.get('/:organizationId/queries', (req: Request, res: Response) => 
  dashboardController.listSavedQueries(req as any, res)
);

router.post('/:organizationId/queries', (req: Request, res: Response) => 
  dashboardController.createSavedQuery(req as any, res)
);

router.post('/:organizationId/queries/:queryId/execute', (req: Request, res: Response) => 
  dashboardController.executeQuery(req as any, res)
);

// ==================== NL Suggestions ====================
router.get('/:organizationId/connectors/:connectorId/suggestions', (req: Request, res: Response) => 
  dashboardController.getNLSuggestions(req as any, res)
);

// ==================== Dashboard Exports ====================
router.post('/:organizationId/dashboards/:dashboardId/export', (req: Request, res: Response) => 
  dashboardController.exportDashboard(req as any, res)
);

router.get('/:organizationId/exports/:exportId', (req: Request, res: Response) => 
  dashboardController.getExportStatus(req as any, res)
);

export default router;

import { Router } from 'express';
import { crmIngestionController } from '../controllers/crm-ingestion.controller';
import { requirePermission } from '../middleware/auth';
import { audit } from '../middleware/audit';

const router = Router();

// Start CRM ingestion service
router.post('/start', 
  requirePermission('manage_analytics'),
  audit('crm_ingestion_start'),
  crmIngestionController.startIngestion
);

// Stop CRM ingestion service  
router.post('/stop',
  requirePermission('manage_analytics'),
  audit('crm_ingestion_stop'),
  crmIngestionController.stopIngestion
);

// Enqueue CRM ingestion job
router.post('/enqueue',
  requirePermission('manage_analytics'),
  audit('crm_ingestion_enqueue'),
  crmIngestionController.enqueueIngestionJob
);

// Get CRM ingestion metrics
router.get('/metrics',
  requirePermission('view_analytics'),
  audit('crm_ingestion_metrics_view'),
  crmIngestionController.getIngestionMetrics
);

// Get CRM ingestion status (queue + metrics)
router.get('/status',
  requirePermission('view_analytics'),
  audit('crm_ingestion_status_view'),
  crmIngestionController.getIngestionStatus
);

export default router;
import { Router } from 'express';
import { alertsController } from '../controllers/alerts.controller';

const router = Router();

// Alert CRUD operations
router.post('/', (req, res) => alertsController.createAlert(req, res));
router.get('/', (req, res) => alertsController.listAlerts(req, res));
router.get('/:id', (req, res) => alertsController.getAlert(req, res));
router.put('/:id', (req, res) => alertsController.updateAlert(req, res));
router.delete('/:id', (req, res) => alertsController.deleteAlert(req, res));

// Alert evaluation and testing
router.post('/:id/test', (req, res) => alertsController.evaluateAlert(req, res));

// Alert notification history
router.get('/:id/notifications', (req, res) => alertsController.getNotificationHistory(req, res));

export default router;

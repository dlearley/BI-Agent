import { Router } from 'express';
import { reportsController } from '../controllers/reports.controller';

const router = Router();

// Report CRUD operations
router.post('/', (req, res) => reportsController.createReport(req, res));
router.get('/', (req, res) => reportsController.listReports(req, res));
router.get('/:id', (req, res) => reportsController.getReport(req, res));
router.put('/:id', (req, res) => reportsController.updateReport(req, res));
router.delete('/:id', (req, res) => reportsController.deleteReport(req, res));

// Report generation
router.post('/send-now', (req, res) => reportsController.sendReportNow(req, res));

// Report generation history
router.get('/:id/generations', (req, res) => reportsController.listReportGenerations(req, res));
router.get('/generations/:id', (req, res) => reportsController.getReportGeneration(req, res));

export default router;

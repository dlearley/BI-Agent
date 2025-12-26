import { Request, Response } from 'express';
import { reportsService } from '../services/reports.service';
import logger from '../utils/logger';

export class ReportsController {
  async createReport(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.email || 'system';
      const report = await reportsService.createReport(req.body, userId);
      
      logger.info('Report created', { reportId: report.id, userId });
      res.status(201).json(report);
    } catch (error) {
      logger.error('Failed to create report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to create report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await reportsService.getReport(id);

      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      res.json(report);
    } catch (error) {
      logger.error('Failed to get report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to get report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async listReports(req: Request, res: Response): Promise<void> {
    try {
      const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
      const facilityId = req.query.facilityId as string | undefined;

      const reports = await reportsService.listReports({ enabled, facilityId });
      res.json(reports);
    } catch (error) {
      logger.error('Failed to list reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to list reports',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const report = await reportsService.updateReport(id, req.body);

      if (!report) {
        res.status(404).json({ error: 'Report not found' });
        return;
      }

      logger.info('Report updated', { reportId: id });
      res.json(report);
    } catch (error) {
      logger.error('Failed to update report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to update report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteReport(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await reportsService.deleteReport(id);

      logger.info('Report deleted', { reportId: id });
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to delete report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async sendReportNow(req: Request, res: Response): Promise<void> {
    try {
      const generation = await reportsService.generateReport(req.body);

      logger.info('Report generated and sent', {
        generationId: generation.id,
        reportId: req.body.reportId,
      });

      res.json(generation);
    } catch (error) {
      logger.error('Failed to generate report', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to generate report',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getReportGeneration(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const generation = await reportsService.getReportGeneration(id);

      if (!generation) {
        res.status(404).json({ error: 'Report generation not found' });
        return;
      }

      res.json(generation);
    } catch (error) {
      logger.error('Failed to get report generation', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to get report generation',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async listReportGenerations(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const generations = await reportsService.listReportGenerations(id, limit);

      res.json(generations);
    } catch (error) {
      logger.error('Failed to list report generations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to list report generations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const reportsController = new ReportsController();

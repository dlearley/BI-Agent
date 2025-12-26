import { Request, Response } from 'express';
import { alertsService } from '../services/alerts.service';
import logger from '../utils/logger';

export class AlertsController {
  async createAlert(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.email || 'system';
      const alert = await alertsService.createAlert(req.body, userId);
      
      logger.info('Alert created', { alertId: alert.id, userId });
      res.status(201).json(alert);
    } catch (error) {
      logger.error('Failed to create alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to create alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const alert = await alertsService.getAlert(id);

      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      res.json(alert);
    } catch (error) {
      logger.error('Failed to get alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to get alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async listAlerts(req: Request, res: Response): Promise<void> {
    try {
      const enabled = req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined;
      const facilityId = req.query.facilityId as string | undefined;

      const alerts = await alertsService.listAlerts({ enabled, facilityId });
      res.json(alerts);
    } catch (error) {
      logger.error('Failed to list alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to list alerts',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async updateAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const alert = await alertsService.updateAlert(id, req.body);

      if (!alert) {
        res.status(404).json({ error: 'Alert not found' });
        return;
      }

      logger.info('Alert updated', { alertId: id });
      res.json(alert);
    } catch (error) {
      logger.error('Failed to update alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to update alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async deleteAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      await alertsService.deleteAlert(id);

      logger.info('Alert deleted', { alertId: id });
      res.status(204).send();
    } catch (error) {
      logger.error('Failed to delete alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to delete alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async evaluateAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const result = await alertsService.evaluateAlert(id);

      logger.info('Alert evaluated', {
        alertId: id,
        triggered: result.triggered,
      });

      res.json(result);
    } catch (error) {
      logger.error('Failed to evaluate alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to evaluate alert',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getNotificationHistory(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await alertsService.getNotificationHistory(id, limit);

      res.json(notifications);
    } catch (error) {
      logger.error('Failed to get notification history', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to get notification history',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const alertsController = new AlertsController();

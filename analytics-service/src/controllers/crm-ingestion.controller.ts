import { Request, Response } from 'express';
import { queueService } from '../services/queue.service';
import { crmIngestionService } from '../services/crm-ingestion.service';
import logger from '../observability/logger';
import { requirePermission } from '../middleware/auth';

export class CRMIngestionController {
  async startIngestion(req: Request, res: Response): Promise<void> {
    try {
      await crmIngestionService.start();
      
      logger.info('CRM ingestion started via API', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      res.json({
        success: true,
        message: 'CRM ingestion service started successfully',
      });
    } catch (error) {
      logger.error('Failed to start CRM ingestion', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to start CRM ingestion service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async stopIngestion(req: Request, res: Response): Promise<void> {
    try {
      await crmIngestionService.stop();
      
      logger.info('CRM ingestion stopped via API', {
        userId: req.user?.id,
        userEmail: req.user?.email,
      });

      res.json({
        success: true,
        message: 'CRM ingestion service stopped successfully',
      });
    } catch (error) {
      logger.error('Failed to stop CRM ingestion', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to stop CRM ingestion service',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async enqueueIngestionJob(req: Request, res: Response): Promise<void> {
    try {
      const { topic, partition, offset, delay } = req.body;

      if (!topic) {
        res.status(400).json({
          success: false,
          message: 'Topic is required',
        });
        return;
      }

      const job = await queueService.enqueueCRMIngestionJob(topic, partition, offset, delay);

      logger.info('CRM ingestion job enqueued', {
        jobId: job.id,
        topic,
        partition,
        offset,
        userId: req.user?.id,
      });

      res.json({
        success: true,
        message: 'CRM ingestion job enqueued successfully',
        data: {
          jobId: job.id,
          topic,
          partition,
          offset,
          delay,
        },
      });
    } catch (error) {
      logger.error('Failed to enqueue CRM ingestion job', { 
        error, 
        userId: req.user?.id,
        body: req.body,
      });
      
      res.status(500).json({
        success: false,
        message: 'Failed to enqueue CRM ingestion job',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getIngestionMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await crmIngestionService.getIngestionMetrics();

      res.json({
        success: true,
        data: metrics,
      });
    } catch (error) {
      logger.error('Failed to get CRM ingestion metrics', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get CRM ingestion metrics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  async getIngestionStatus(req: Request, res: Response): Promise<void> {
    try {
      const queueStats = await queueService.getQueueStats();
      const metrics = await crmIngestionService.getIngestionMetrics();

      res.json({
        success: true,
        data: {
          queue: queueStats,
          ingestion: metrics,
        },
      });
    } catch (error) {
      logger.error('Failed to get CRM ingestion status', { error, userId: req.user?.id });
      
      res.status(500).json({
        success: false,
        message: 'Failed to get CRM ingestion status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

export const crmIngestionController = new CRMIngestionController();
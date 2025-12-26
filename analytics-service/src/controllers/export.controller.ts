import { Request, Response } from 'express';
import { exportService } from '../services/export.service';
import { queueService } from '../services/queue.service';
import { 
  CreateExportScheduleRequest, 
  UpdateExportScheduleRequest,
  ExportType,
  ExportFormat,
  ExportJobStatus,
  SecurityContext,
  ExportJobData
} from '../types';

export class ExportController {
  async createExportSchedule(req: Request, res: Response): Promise<void> {
    try {
      const securityContext = req.user as SecurityContext;
      const request: CreateExportScheduleRequest = req.body;

      // Validate request
      if (!request.name || !request.exportType || !request.format || !request.scheduleExpression) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }

      if (!request.recipients || request.recipients.length === 0) {
        res.status(400).json({ error: 'At least one recipient is required' });
        return;
      }

      const schedule = await exportService.createExportSchedule(request, securityContext);
      
      res.status(201).json({
        success: true,
        data: schedule
      });
    } catch (error) {
      console.error('Error creating export schedule:', error);
      res.status(500).json({ 
        error: 'Failed to create export schedule',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async updateExportSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const securityContext = req.user as SecurityContext;
      const request: UpdateExportScheduleRequest = req.body;

      const schedule = await exportService.updateExportSchedule(id, request, securityContext);
      
      res.json({
        success: true,
        data: schedule
      });
    } catch (error) {
      console.error('Error updating export schedule:', error);
      if (error instanceof Error && error.message === 'Export schedule not found') {
        res.status(404).json({ error: 'Export schedule not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to update export schedule',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async deleteExportSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const securityContext = req.user as SecurityContext;

      await exportService.deleteExportSchedule(id, securityContext);
      
      res.json({
        success: true,
        message: 'Export schedule deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting export schedule:', error);
      if (error instanceof Error && error.message === 'Export schedule not found') {
        res.status(404).json({ error: 'Export schedule not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to delete export schedule',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportSchedules(req: Request, res: Response): Promise<void> {
    try {
      const securityContext = req.user as SecurityContext;
      const schedules = await exportService.getExportSchedules(securityContext);
      
      res.json({
        success: true,
        data: schedules
      });
    } catch (error) {
      console.error('Error fetching export schedules:', error);
      res.status(500).json({ 
        error: 'Failed to fetch export schedules',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportSchedule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const securityContext = req.user as SecurityContext;

      const schedule = await exportService.getExportSchedule(id, securityContext);
      
      res.json({
        success: true,
        data: schedule
      });
    } catch (error) {
      console.error('Error fetching export schedule:', error);
      if (error instanceof Error && error.message === 'Export schedule not found') {
        res.status(404).json({ error: 'Export schedule not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to fetch export schedule',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportJobs(req: Request, res: Response): Promise<void> {
    try {
      const securityContext = req.user as SecurityContext;
      const limit = parseInt(req.query.limit as string) || 50;
      const jobs = await exportService.getExportJobs(securityContext, limit);
      
      res.json({
        success: true,
        data: jobs
      });
    } catch (error) {
      console.error('Error fetching export jobs:', error);
      res.status(500).json({ 
        error: 'Failed to fetch export jobs',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const securityContext = req.user as SecurityContext;

      const job = await exportService.getExportJob(id, securityContext);
      
      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error('Error fetching export job:', error);
      if (error instanceof Error && error.message === 'Export job not found') {
        res.status(404).json({ error: 'Export job not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to fetch export job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async createExportJob(req: Request, res: Response): Promise<void> {
    try {
      const securityContext = req.user as SecurityContext;
      const { exportType, format, filters = {}, scheduleId } = req.body;

      // Validate request
      if (!exportType || !format) {
        res.status(400).json({ error: 'Missing required fields: exportType, format' });
        return;
      }

      if (!Object.values(ExportType).includes(exportType)) {
        res.status(400).json({ error: 'Invalid export type' });
        return;
      }

      if (!Object.values(ExportFormat).includes(format)) {
        res.status(400).json({ error: 'Invalid export format' });
        return;
      }

      // Create export job in database
      const job = await exportService.createExportJob(
        exportType,
        format,
        filters,
        securityContext,
        scheduleId
      );

      // Enqueue export job
      const jobData: ExportJobData = {
        type: 'export_data',
        exportType,
        format,
        filters,
        scheduleId,
        exportJobId: job.id,
        createdBy: securityContext.user.id
      };

      await queueService.enqueueExportJob(jobData);
      
      res.status(201).json({
        success: true,
        data: job
      });
    } catch (error) {
      console.error('Error creating export job:', error);
      res.status(500).json({ 
        error: 'Failed to create export job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportJobStatus(req: Request, res: Response): Promise<void> {
    try {
      const { jobId } = req.params;
      const status = await queueService.getExportJobStatus(jobId);
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      console.error('Error fetching export job status:', error);
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ error: 'Export job not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to fetch export job status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async getExportQueueStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = await queueService.getExportQueueStats();
      
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Error fetching export queue stats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch export queue stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async downloadExportFile(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const securityContext = req.user as SecurityContext;

      const job = await exportService.getExportJob(id, securityContext);
      
      if (!job.signedUrl || !job.signedUrlExpiresAt || new Date() > job.signedUrlExpiresAt) {
        res.status(410).json({ error: 'Download link has expired' });
        return;
      }

      res.json({
        success: true,
        data: {
          downloadUrl: job.signedUrl,
          fileName: `${job.exportType}_${job.id}.${job.format}`,
          fileSize: job.fileSize,
          expiresAt: job.signedUrlExpiresAt
        }
      });
    } catch (error) {
      console.error('Error generating download link:', error);
      if (error instanceof Error && error.message === 'Export job not found') {
        res.status(404).json({ error: 'Export job not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to generate download link',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async retryExportJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const securityContext = req.user as SecurityContext;

      const job = await exportService.getExportJob(id, securityContext);
      
      if (job.status !== 'failed') {
        res.status(400).json({ error: 'Only failed jobs can be retried' });
        return;
      }

      // Re-enqueue the export job
      const jobData: ExportJobData = {
        type: 'export_data',
        exportType: job.exportType,
        format: job.format,
        filters: job.filters,
        scheduleId: job.scheduleId,
        exportJobId: job.id,
        createdBy: securityContext.user.id
      };

      await queueService.enqueueExportJob(jobData);
      
      res.json({
        success: true,
        message: 'Export job queued for retry'
      });
    } catch (error) {
      console.error('Error retrying export job:', error);
      if (error instanceof Error && error.message === 'Export job not found') {
        res.status(404).json({ error: 'Export job not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to retry export job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  async cancelExportJob(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const securityContext = req.user as SecurityContext;

      const job = await exportService.getExportJob(id, securityContext);
      
      if (job.status === 'completed') {
        res.status(400).json({ error: 'Cannot cancel completed jobs' });
        return;
      }

      if (job.status === 'cancelled') {
        res.status(400).json({ error: 'Job is already cancelled' });
        return;
      }

      // Update job status to cancelled
      await exportService['updateExportJob'](id, {
        status: ExportJobStatus.CANCELLED,
        completedAt: new Date()
      });
      
      res.json({
        success: true,
        message: 'Export job cancelled successfully'
      });
    } catch (error) {
      console.error('Error cancelling export job:', error);
      if (error instanceof Error && error.message === 'Export job not found') {
        res.status(404).json({ error: 'Export job not found' });
        return;
      }
      res.status(500).json({ 
        error: 'Failed to cancel export job',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const exportController = new ExportController();
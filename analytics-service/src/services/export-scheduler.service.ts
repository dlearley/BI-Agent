import { Pool } from 'pg';
import * as cronParser from 'cron-parser';
import { queueService } from './queue.service';
import { exportService } from './export.service';
import { ExportJobData, RecipientType } from '../types';
import { db } from '../config/database';

export class ExportSchedulerService {
  private db: Pool;

  constructor(db: Pool) {
    this.db = db;
  }

  async processScheduledExports(): Promise<void> {
    try {
      // Get all active schedules that are due to run
      const query = `
        SELECT * FROM export_schedules 
        WHERE is_active = true 
        AND next_run_at <= NOW()
        ORDER BY next_run_at ASC
      `;
      
      const result = await this.db.query(query);
      
      for (const scheduleRow of result.rows) {
        try {
          await this.processScheduledExport(scheduleRow);
        } catch (error) {
          console.error(`Error processing scheduled export ${scheduleRow.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled exports:', error);
    }
  }

  private async processScheduledExport(scheduleRow: any): Promise<void> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Get recipients for this schedule
      const recipientsQuery = `
        SELECT * FROM export_recipients 
        WHERE schedule_id = $1 AND is_active = true
      `;
      const recipientsResult = await client.query(recipientsQuery, [scheduleRow.id]);
      
      if (recipientsResult.rows.length === 0) {
        console.warn(`No active recipients found for schedule ${scheduleRow.id}`);
        await this.updateNextRunTime(scheduleRow.id, client);
        await client.query('COMMIT');
        return;
      }

      // Create export job
      const jobQuery = `
        INSERT INTO export_jobs (
          schedule_id, export_type, format, filters, status, 
          started_at, created_by
        ) VALUES ($1, $2, $3, $4, 'processing', NOW(), $5)
        RETURNING *
      `;
      
      const jobResult = await client.query(jobQuery, [
        scheduleRow.id,
        scheduleRow.export_type,
        scheduleRow.format,
        scheduleRow.filters,
        scheduleRow.created_by
      ]);

      const job = jobResult.rows[0];

      // Update schedule with last run time
      await client.query(
        'UPDATE export_schedules SET last_run_at = NOW() WHERE id = $1',
        [scheduleRow.id]
      );

      // Calculate and update next run time
      await this.updateNextRunTime(scheduleRow.id, client);

      await client.query('COMMIT');

      // Prepare recipients for export job
      const recipients = recipientsResult.rows.map(row => ({
        id: row.id,
        scheduleId: row.schedule_id,
        recipientType: row.recipient_type,
        recipientAddress: row.recipient_address,
        isActive: row.is_active,
        createdAt: row.created_at
      }));

      // Enqueue export job
      const exportJobData: ExportJobData = {
        type: 'export_data',
        exportType: scheduleRow.export_type,
        format: scheduleRow.format,
        filters: scheduleRow.filters,
        scheduleId: scheduleRow.id,
        exportJobId: job.id,
        createdBy: scheduleRow.created_by,
        recipients,
        templateData: scheduleRow.template_data
      };

      await queueService.enqueueExportJob(exportJobData);
      
      console.log(`Scheduled export job created: ${job.id} for schedule: ${scheduleRow.id}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private async updateNextRunTime(scheduleId: string, client: any): Promise<void> {
    try {
      // Get the schedule expression
      const scheduleQuery = 'SELECT schedule_expression FROM export_schedules WHERE id = $1';
      const scheduleResult = await client.query(scheduleQuery, [scheduleId]);
      
      if (scheduleResult.rows.length === 0) {
        return;
      }

      const scheduleExpression = scheduleResult.rows[0].schedule_expression;
      const nextRunAt = this.calculateNextRun(scheduleExpression);

      // Update next run time
      await client.query(
        'UPDATE export_schedules SET next_run_at = $1 WHERE id = $2',
        [nextRunAt, scheduleId]
      );
    } catch (error) {
      console.error('Error updating next run time:', error);
      // Set a default next run time (1 hour from now) if calculation fails
      await client.query(
        'UPDATE export_schedules SET next_run_at = NOW() + INTERVAL \'1 hour\' WHERE id = $1',
        [scheduleId]
      );
    }
  }

  private calculateNextRun(cronExpression: string): Date {
    try {
      const interval = cronParser.parseExpression(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      console.error('Error parsing cron expression:', cronExpression, error);
      // Default to 1 hour from now if cron is invalid
      return new Date(Date.now() + 60 * 60 * 1000);
    }
  }

  async startScheduler(): Promise<void> {
    // Process scheduled exports every minute
    setInterval(async () => {
      await this.processScheduledExports();
    }, 60 * 1000); // 1 minute

    console.log('Export scheduler started - checking for scheduled exports every minute');
  }
}

export const exportSchedulerService = new ExportSchedulerService((db as any).pool);
import { Pool } from 'pg';
import { S3 } from 'aws-sdk';
import * as nodemailer from 'nodemailer';
import { WebClient } from '@slack/web-api';
import * as csvWriter from 'csv-writer';
import puppeteer from 'puppeteer';
import * as cronParser from 'cron-parser';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { db } from '../config/database';
import { 
  ExportSchedule,
  ExportJob,
  ExportRecipient,
  ExportNotification,
  CreateExportScheduleRequest,
  UpdateExportScheduleRequest,
  ExportJobData,
  ExportJobResult,
  ExportType,
  ExportFormat,
  ExportJobStatus,
  RecipientType,
  NotificationStatus,
  AnalyticsQuery,
  EmailTemplate,
  SlackTemplate,
  SecurityContext,
  Permission,
  User
} from '../types';
import { analyticsService } from './analytics.service';

export class ExportService {
  private db: Pool;
  private s3: S3;
  private emailTransporter: nodemailer.Transporter;
  private slackClient: WebClient;

  constructor(db: Pool) {
    this.db = db;
    
    // Initialize S3 client
    this.s3 = new S3({
      accessKeyId: config.exports.s3.accessKeyId,
      secretAccessKey: config.exports.s3.secretAccessKey,
      region: config.exports.s3.region,
      endpoint: config.exports.s3.endpoint,
    });

    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransport({
      host: config.exports.email.smtpHost,
      port: config.exports.email.smtpPort,
      secure: config.exports.email.smtpPort === 465,
      auth: {
        user: config.exports.email.smtpUser,
        pass: config.exports.email.smtpPassword,
      },
    });

    // Initialize Slack client
    this.slackClient = new WebClient(config.exports.slack.botToken);
  }

  async createExportSchedule(
    request: CreateExportScheduleRequest,
    securityContext: SecurityContext
  ): Promise<ExportSchedule> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Create export schedule
      const scheduleQuery = `
        INSERT INTO export_schedules (
          name, description, export_type, format, schedule_expression,
          is_active, filters, template_data, created_by, next_run_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      
      const nextRunAt = this.calculateNextRun(request.scheduleExpression);
      
      const scheduleResult = await client.query(scheduleQuery, [
        request.name,
        request.description,
        request.exportType,
        request.format,
        request.scheduleExpression,
        true,
        JSON.stringify(request.filters || {}),
        JSON.stringify(request.templateData),
        securityContext.user.id,
        nextRunAt
      ]);

      const schedule = this.mapRowToExportSchedule(scheduleResult.rows[0]);

      // Create recipients
      for (const recipient of request.recipients) {
        const recipientQuery = `
          INSERT INTO export_recipients (schedule_id, recipient_type, recipient_address)
          VALUES ($1, $2, $3)
        `;
        await client.query(recipientQuery, [
          schedule.id,
          recipient.recipientType,
          recipient.recipientAddress
        ]);
      }

      await client.query('COMMIT');
      return schedule;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateExportSchedule(
    id: string,
    request: UpdateExportScheduleRequest,
    securityContext: SecurityContext
  ): Promise<ExportSchedule> {
    const client = await this.db.connect();
    
    try {
      await client.query('BEGIN');

      // Update schedule
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (request.name !== undefined) {
        updateFields.push(`name = $${paramIndex++}`);
        updateValues.push(request.name);
      }
      if (request.description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        updateValues.push(request.description);
      }
      if (request.scheduleExpression !== undefined) {
        updateFields.push(`schedule_expression = $${paramIndex++}`);
        updateValues.push(request.scheduleExpression);
        
        // Recalculate next run time if schedule changed
        const nextRunAt = this.calculateNextRun(request.scheduleExpression);
        updateFields.push(`next_run_at = $${paramIndex++}`);
        updateValues.push(nextRunAt);
      }
      if (request.isActive !== undefined) {
        updateFields.push(`is_active = $${paramIndex++}`);
        updateValues.push(request.isActive);
      }
      if (request.filters !== undefined) {
        updateFields.push(`filters = $${paramIndex++}`);
        updateValues.push(JSON.stringify(request.filters));
      }
      if (request.templateData !== undefined) {
        updateFields.push(`template_data = $${paramIndex++}`);
        updateValues.push(JSON.stringify(request.templateData));
      }

      if (updateFields.length === 0) {
        throw new Error('No fields to update');
      }

      const scheduleQuery = `
        UPDATE export_schedules 
        SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      updateValues.push(id);
      const scheduleResult = await client.query(scheduleQuery, updateValues);
      
      if (scheduleResult.rows.length === 0) {
        throw new Error('Export schedule not found');
      }

      // Update recipients if provided
      if (request.recipients !== undefined) {
        // Delete existing recipients
        await client.query(
          'DELETE FROM export_recipients WHERE schedule_id = $1',
          [id]
        );

        // Add new recipients
        for (const recipient of request.recipients) {
          const recipientQuery = `
            INSERT INTO export_recipients (schedule_id, recipient_type, recipient_address)
            VALUES ($1, $2, $3)
          `;
          await client.query(recipientQuery, [
            id,
            recipient.recipientType,
            recipient.recipientAddress
          ]);
        }
      }

      await client.query('COMMIT');
      return this.mapRowToExportSchedule(scheduleResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async deleteExportSchedule(id: string, securityContext: SecurityContext): Promise<void> {
    const query = 'DELETE FROM export_schedules WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    if (result.rows.length === 0) {
      throw new Error('Export schedule not found');
    }
  }

  async getExportSchedules(securityContext: SecurityContext): Promise<ExportSchedule[]> {
    const query = `
      SELECT * FROM export_schedules 
      WHERE created_by = $1 OR $2 = 'admin'
      ORDER BY created_at DESC
    `;
    
    const result = await this.db.query(query, [securityContext.user.id, securityContext.user.role]);
    return result.rows.map(row => this.mapRowToExportSchedule(row));
  }

  async getExportSchedule(id: string, securityContext: SecurityContext): Promise<ExportSchedule> {
    const query = `
      SELECT * FROM export_schedules 
      WHERE id = $1 AND (created_by = $2 OR $3 = 'admin')
    `;
    
    const result = await this.db.query(query, [id, securityContext.user.id, securityContext.user.role]);
    
    if (result.rows.length === 0) {
      throw new Error('Export schedule not found');
    }
    
    return this.mapRowToExportSchedule(result.rows[0]);
  }

  async getExportJobs(securityContext: SecurityContext, limit = 50): Promise<ExportJob[]> {
    const query = `
      SELECT * FROM export_jobs 
      WHERE created_by = $1 OR $2 = 'admin'
      ORDER BY created_at DESC 
      LIMIT $3
    `;
    
    const result = await this.db.query(query, [securityContext.user.id, securityContext.user.role, limit]);
    return result.rows.map(row => this.mapRowToExportJob(row));
  }

  async getExportJob(id: string, securityContext: SecurityContext): Promise<ExportJob> {
    const query = `
      SELECT * FROM export_jobs 
      WHERE id = $1 AND (created_by = $2 OR $3 = 'admin')
    `;
    
    const result = await this.db.query(query, [id, securityContext.user.id, securityContext.user.role]);
    
    if (result.rows.length === 0) {
      throw new Error('Export job not found');
    }
    
    return this.mapRowToExportJob(result.rows[0]);
  }

  async createExportJob(
    exportType: ExportType,
    format: ExportFormat,
    filters: AnalyticsQuery,
    securityContext: SecurityContext,
    scheduleId?: string
  ): Promise<ExportJob> {
    const query = `
      INSERT INTO export_jobs (
        export_type, format, filters, status, created_by, ${scheduleId ? 'schedule_id,' : ''}
        started_at
      ) VALUES ($1, $2, $3, $4, $5, ${scheduleId ? '$6,' : ''} NOW())
      RETURNING *
    `;
    
    const values = [
      exportType,
      format,
      JSON.stringify(filters),
      ExportJobStatus.PROCESSING,
      securityContext.user.id
    ];
    
    if (scheduleId) {
      values.push(scheduleId);
    }
    
    const result = await this.db.query(query, values);
    return this.mapRowToExportJob(result.rows[0]);
  }

  async processExportJob(jobData: ExportJobData): Promise<ExportJobResult> {
    const job = await this.getExportJob(jobData.exportJobId, {
      user: { id: jobData.createdBy || 'unknown', role: 'admin' } as any,
      complianceFramework: 'hipaa',
      preset: {} as any,
      auditRequired: false,
      piiAccess: false
    });

    try {
      // Generate export data
      const exportData = await this.generateExportData(job.exportType, job.filters);
      
      // Generate file
      const { filePath, fileSize } = await this.generateExportFile(
        exportData,
        job.format,
        job.exportType,
        job.id
      );
      
      // Generate signed URL
      const signedUrl = await this.generateSignedUrl(filePath);
      const signedUrlExpiresAt = new Date(Date.now() + config.exports.signedUrlTTL * 1000);
      
      // Update job with success
      await this.updateExportJob(job.id, {
        status: ExportJobStatus.COMPLETED,
        filePath,
        fileSize,
        signedUrl,
        signedUrlExpiresAt,
        completedAt: new Date()
      });
      
      // Send notifications if recipients are provided
      if (jobData.recipients && jobData.templateData) {
        await this.sendNotifications(job.id, jobData.recipients, jobData.templateData, filePath);
      }
      
      return {
        success: true,
        message: `Export completed successfully`,
        exportJobId: job.id,
        filePath,
        fileSize,
        signedUrl,
        signedUrlExpiresAt: signedUrlExpiresAt.toISOString()
      };
    } catch (error) {
      // Update job with error
      await this.updateExportJob(job.id, {
        status: ExportJobStatus.FAILED,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        completedAt: new Date()
      });
      
      return {
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: error instanceof Error ? error.message : 'Unknown error',
        exportJobId: job.id
      };
    }
  }

  private async generateExportData(exportType: ExportType, filters: AnalyticsQuery): Promise<any> {
    // Create a mock user for export service calls
    const mockUser: User = {
      id: 'export-service',
      email: 'export-service@example.com',
      role: 'admin' as any,
      permissions: [Permission.VIEW_ANALYTICS, Permission.EXPORT_DATA],
      facilityId: undefined
    };

    switch (exportType) {
      case ExportType.DASHBOARD:
        return await analyticsService.getCombinedKPIs(filters, mockUser);
      case ExportType.KPI:
        return await analyticsService.getCombinedKPIs(filters, mockUser);
      case ExportType.COMPLIANCE:
        return await analyticsService.getComplianceMetrics(filters, mockUser);
      case ExportType.REVENUE:
        return await analyticsService.getRevenueMetrics(filters, mockUser);
      case ExportType.OUTREACH:
        return await analyticsService.getOutreachMetrics(filters, mockUser);
      default:
        throw new Error(`Unsupported export type: ${exportType}`);
    }
  }

  private async generateExportFile(
    data: any,
    format: ExportFormat,
    exportType: ExportType,
    jobId: string
  ): Promise<{ filePath: string; fileSize: number }> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${exportType}_${timestamp}_${jobId}.${format}`;
    const filePath = `exports/${exportType}/${fileName}`;
    
    let fileContent: Buffer;
    
    if (format === ExportFormat.CSV) {
      fileContent = await this.generateCSV(data);
    } else if (format === ExportFormat.PDF) {
      fileContent = await this.generatePDF(data, exportType);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
    
    // Upload to S3
    await this.s3.upload({
      Bucket: config.exports.s3.bucket,
      Key: filePath,
      Body: fileContent,
      ContentType: format === ExportFormat.CSV ? 'text/csv' : 'application/pdf',
      ServerSideEncryption: 'AES256'
    }).promise();
    
    return {
      filePath,
      fileSize: fileContent.length
    };
  }

  private async generateCSV(data: any): Promise<Buffer> {
    // Convert nested data to flat CSV format
    const flatData = this.flattenData(data);
    
    if (flatData.length === 0) {
      return Buffer.from('');
    }
    
    const headers = Object.keys(flatData[0]);
    const csvString = [
      headers.join(','),
      ...flatData.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    return Buffer.from(csvString, 'utf-8');
  }

  private async generatePDF(data: any, exportType: ExportType): Promise<Buffer> {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      const page = await browser.newPage();
      
      // Create HTML content
      const html = this.generatePDFHTML(data, exportType);
      await page.setContent(html);
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '1cm',
          right: '1cm',
          bottom: '1cm',
          left: '1cm'
        }
      });
      
      return pdfBuffer;
    } finally {
      await browser.close();
    }
  }

  private generatePDFHTML(data: any, exportType: ExportType): string {
    const title = `${exportType.charAt(0).toUpperCase() + exportType.slice(1)} Analytics Report`;
    const timestamp = new Date().toLocaleString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; }
          h2 { color: #666; margin-top: 30px; }
          table { border-collapse: collapse; width: 100%; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f2f2f2; }
          .timestamp { color: #666; font-size: 14px; margin-bottom: 30px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <div class="timestamp">Generated on ${timestamp}</div>
        
        <pre>${JSON.stringify(data, null, 2)}</pre>
      </body>
      </html>
    `;
  }

  private flattenData(data: any): any[] {
    // Simple flattening for CSV export
    if (Array.isArray(data)) {
      return data;
    }
    
    if (typeof data === 'object' && data !== null) {
      return [data];
    }
    
    return [{ value: data }];
  }

  private async generateSignedUrl(filePath: string): Promise<string> {
    return this.s3.getSignedUrl('getObject', {
      Bucket: config.exports.s3.bucket,
      Key: filePath,
      Expires: config.exports.signedUrlTTL,
      ResponseContentDisposition: 'attachment'
    });
  }

  private async updateExportJob(id: string, updates: Partial<ExportJob>): Promise<void> {
    const updateFields: string[] = [];
    const updateValues: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        updateFields.push(`${this.camelToSnake(key)} = $${paramIndex++}`);
        if (typeof value === 'object' && value !== null) {
          updateValues.push(JSON.stringify(value));
        } else {
          updateValues.push(value);
        }
      }
    });

    if (updateFields.length === 0) {
      return;
    }

    const query = `
      UPDATE export_jobs 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `;
    
    updateValues.push(id);
    await this.db.query(query, updateValues);
  }

  private async sendNotifications(
    jobId: string,
    recipients: ExportRecipient[],
    templateData: EmailTemplate | SlackTemplate,
    filePath: string
  ): Promise<void> {
    const signedUrl = await this.generateSignedUrl(filePath);
    
    for (const recipient of recipients) {
      try {
        if (recipient.recipientType === RecipientType.EMAIL) {
          await this.sendEmailNotification(recipient.recipientAddress, templateData as EmailTemplate, signedUrl);
        } else if (recipient.recipientType === RecipientType.SLACK) {
          await this.sendSlackNotification(recipient.recipientAddress, templateData as SlackTemplate, signedUrl);
        }
        
        // Record successful notification
        await this.recordNotification(jobId, recipient, NotificationStatus.SENT);
      } catch (error) {
        // Record failed notification
        await this.recordNotification(jobId, recipient, NotificationStatus.FAILED, 
          error instanceof Error ? error.message : 'Unknown error');
      }
    }
  }

  private async sendEmailNotification(
    emailAddress: string,
    template: EmailTemplate,
    fileUrl: string
  ): Promise<void> {
    const mailOptions = {
      from: `${config.exports.email.fromName} <${config.exports.email.fromEmail}>`,
      to: emailAddress,
      subject: template.subject,
      html: template.body.replace('{{FILE_URL}}', fileUrl),
      attachments: template.includeAttachment ? [{
        filename: template.attachmentName || 'export.csv',
        path: fileUrl
      }] : undefined
    };

    await this.emailTransporter.sendMail(mailOptions);
  }

  private async sendSlackNotification(
    channel: string,
    template: SlackTemplate,
    fileUrl: string
  ): Promise<void> {
    const message = template.message.replace('{{FILE_URL}}', fileUrl);
    
    if (template.includeFile && template.fileName) {
      // Upload file to Slack
      await this.slackClient.files.uploadV2({
        channel,
        file: fileUrl,
        filename: template.fileName,
        initial_comment: message
      });
    } else {
      // Send simple message
      await this.slackClient.chat.postMessage({
        channel,
        text: message
      });
    }
  }

  private async recordNotification(
    jobId: string,
    recipient: ExportRecipient,
    status: NotificationStatus,
    errorMessage?: string
  ): Promise<void> {
    const query = `
      INSERT INTO export_notifications (
        job_id, recipient_id, notification_type, recipient_address, status, 
        ${status === NotificationStatus.SENT ? 'sent_at' : ''}, error_message
      ) VALUES ($1, $2, $3, $4, $5, ${status === NotificationStatus.SENT ? 'NOW()' : 'NULL'}, $6)
    `;
    
    await this.db.query(query, [
      jobId,
      recipient.id,
      recipient.recipientType,
      recipient.recipientAddress,
      status,
      errorMessage
    ]);
  }

  private calculateNextRun(cronExpression: string): Date {
    try {
      const interval = cronParser.parseExpression(cronExpression);
      return interval.next().toDate();
    } catch (error) {
      // Default to 1 hour from now if cron is invalid
      return new Date(Date.now() + 60 * 60 * 1000);
    }
  }

  private mapRowToExportSchedule(row: any): ExportSchedule {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      exportType: row.export_type,
      format: row.format,
      scheduleExpression: row.schedule_expression,
      isActive: row.is_active,
      filters: row.filters,
      templateData: row.template_data,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastRunAt: row.last_run_at,
      nextRunAt: row.next_run_at
    };
  }

  private mapRowToExportJob(row: any): ExportJob {
    return {
      id: row.id,
      scheduleId: row.schedule_id,
      status: row.status,
      exportType: row.export_type,
      format: row.format,
      filters: row.filters,
      filePath: row.file_path,
      fileSize: row.file_size,
      signedUrl: row.signed_url,
      signedUrlExpiresAt: row.signed_url_expires_at,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdBy: row.created_by,
      createdAt: row.created_at
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  async cleanupOldExports(): Promise<number> {
    const query = 'SELECT cleanup_old_export_jobs($1) as deleted_count';
    const result = await this.db.query(query, [config.exports.retentionDays]);
    return result.rows[0].deleted_count;
  }
}

export const exportService = new ExportService((db as any).pool);
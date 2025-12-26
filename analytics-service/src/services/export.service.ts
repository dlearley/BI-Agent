import { Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import fs from 'fs';
import path from 'path';
import { dashboardService } from './dashboard.service';
import { DashboardQuery, ExportJob, ExportStatus, User } from '../types';
import { db } from '../config/database';

export class ExportService {
  private readonly exportDir = path.join(__dirname, '../../exports');

  constructor() {
    // Ensure export directory exists
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  async streamToCSV(query: DashboardQuery, user: User, jobId: string): Promise<string> {
    const filePath = path.join(this.exportDir, `export_${jobId}_${Date.now()}.csv`);
    const writeStream = fs.createWriteStream(filePath);

    try {
      // Update job status to processing
      await dashboardService.updateExportJob(jobId, {
        status: ExportStatus.PROCESSING,
        startedAt: new Date(),
      }, user);

      // Get the data based on query
      const data = await this.getExportData(query, user);
      
      if (data.length === 0) {
        await dashboardService.updateExportJob(jobId, {
          status: ExportStatus.COMPLETED,
          completedAt: new Date(),
          recordCount: 0,
          fileSize: 0,
        }, user);
        return filePath;
      }

      // Create CSV stream
      const csvStream = this.createCSVStream(data);
      
      // Pipe to file
      await pipeline(csvStream, writeStream);

      // Get file size
      const stats = fs.statSync(filePath);

      // Update job status to completed
      await dashboardService.updateExportJob(jobId, {
        status: ExportStatus.COMPLETED,
        filePath,
        completedAt: new Date(),
        recordCount: data.length,
        fileSize: stats.size,
      }, user);

      return filePath;
    } catch (error) {
      console.error('Error streaming to CSV:', error);
      
      // Update job status to failed
      await dashboardService.updateExportJob(jobId, {
        status: ExportStatus.FAILED,
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      }, user);

      // Clean up partial file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      throw error;
    }
  }

  private async getExportData(query: DashboardQuery, user: User): Promise<any[]> {
    const dashboardType = query.dashboardType;
    const timeRange = this.resolveTimeRange(query.timeRange);

    let sql = '';
    const params: any[] = [];

    switch (dashboardType) {
      case 'pipeline':
        sql = this.buildPipelineExportSQL(query, user, timeRange);
        break;
      case 'revenue':
        sql = this.buildRevenueExportSQL(query, user, timeRange);
        break;
      case 'compliance':
        sql = this.buildComplianceExportSQL(query, user, timeRange);
        break;
      case 'outreach':
        sql = this.buildOutreachExportSQL(query, user, timeRange);
        break;
      case 'combined':
        sql = this.buildCombinedExportSQL(query, user, timeRange);
        break;
      default:
        throw new Error(`Unsupported dashboard type for export: ${dashboardType}`);
    }

    const result = await db.query(sql, params);
    return result;
  }

  private buildPipelineExportSQL(query: DashboardQuery, user: User, timeRange: any): string {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        total_applications,
        hired_count,
        rejected_count,
        pending_count,
        interview_count,
        avg_time_to_fill_days,
        month
      FROM analytics.pipeline_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` ORDER BY month DESC, facility_id`;

    // Store params for later use
    (this as any).lastParams = params;
    return sql;
  }

  private buildRevenueExportSQL(query: DashboardQuery, user: User, timeRange: any): string {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        total_revenue,
        avg_revenue_per_invoice,
        month
      FROM analytics.revenue_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` ORDER BY month DESC, facility_id`;

    // Store params for later use
    (this as any).lastParams = params;
    return sql;
  }

  private buildComplianceExportSQL(query: DashboardQuery, user: User, timeRange: any): string {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        total_applications,
        compliant_applications,
        compliance_rate,
        violation_count,
        month
      FROM analytics.compliance_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` ORDER BY month DESC, facility_id`;

    // Store params for later use
    (this as any).lastParams = params;
    return sql;
  }

  private buildOutreachExportSQL(query: DashboardQuery, user: User, timeRange: any): string {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        total_outreach,
        response_rate,
        conversion_rate,
        month
      FROM analytics.outreach_kpis_materialized
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` ORDER BY month DESC, facility_id`;

    // Store params for later use
    (this as any).lastParams = params;
    return sql;
  }

  private buildCombinedExportSQL(query: DashboardQuery, user: User, timeRange: any): string {
    let sql = `
      SELECT 
        facility_id,
        facility_name,
        total_applications,
        hired_count,
        avg_time_to_fill_days,
        compliant_applications,
        compliance_rate,
        violation_count,
        total_revenue,
        avg_revenue_per_invoice,
        total_outreach,
        avg_response_rate,
        avg_conversion_rate,
        month
      FROM analytics.combined_kpis
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (timeRange.startDate) {
      sql += ` AND month >= $${paramIndex++}`;
      params.push(timeRange.startDate);
    }

    if (timeRange.endDate) {
      sql += ` AND month <= $${paramIndex++}`;
      params.push(timeRange.endDate);
    }

    if (query.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(query.facilityId);
    }

    if (user.role !== 'admin' && user.facilityId) {
      sql += ` AND facility_id = $${paramIndex++}`;
      params.push(user.facilityId);
    }

    sql += ` ORDER BY month DESC, facility_id`;

    // Store params for later use
    (this as any).lastParams = params;
    return sql;
  }

  private createCSVStream(data: any[]): Readable {
    if (!data || data.length === 0) {
      return Readable.from([]);
    }

    const headers = Object.keys(data[0]);
    let isFirstRow = true;

    const csvTransform = new Transform({
      objectMode: true,
      transform(chunk, encoding, callback) {
        if (isFirstRow) {
          this.push(headers.join(',') + '\n');
          isFirstRow = false;
        }

        const row = headers.map(header => {
          const value = chunk[header];
          // Handle null/undefined values and escape commas and quotes
          if (value === null || value === undefined) {
            return '';
          }
          const stringValue = String(value);
          if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
            return `"${stringValue.replace(/"/g, '""')}"`;
          }
          return stringValue;
        }).join(',');

        this.push(row + '\n');
        callback();
      }
    });

    const readable = Readable.from(data);
    return readable.pipe(csvTransform);
  }

  private resolveTimeRange(timeRange?: any): { startDate?: string; endDate?: string } {
    if (!timeRange) return {};

    const now = new Date();
    
    if (timeRange.preset) {
      switch (timeRange.preset) {
        case 'today':
          return {
            startDate: now.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'yesterday':
          const yesterday = new Date(now);
          yesterday.setDate(yesterday.getDate() - 1);
          const yesterdayStr = yesterday.toISOString().split('T')[0];
          return { startDate: yesterdayStr, endDate: yesterdayStr };
        case 'last7days':
          const weekAgo = new Date(now);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return {
            startDate: weekAgo.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'last30days':
          const monthAgo = new Date(now);
          monthAgo.setDate(monthAgo.getDate() - 30);
          return {
            startDate: monthAgo.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'last90days':
          const quarterAgo = new Date(now);
          quarterAgo.setDate(quarterAgo.getDate() - 90);
          return {
            startDate: quarterAgo.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'thismonth':
          const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          return {
            startDate: firstOfMonth.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        case 'lastmonth':
          const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          return {
            startDate: firstOfLastMonth.toISOString().split('T')[0],
            endDate: lastOfLastMonth.toISOString().split('T')[0],
          };
        case 'thisyear':
          const firstOfYear = new Date(now.getFullYear(), 0, 1);
          return {
            startDate: firstOfYear.toISOString().split('T')[0],
            endDate: now.toISOString().split('T')[0],
          };
        default:
          return {
            startDate: timeRange.startDate,
            endDate: timeRange.endDate,
          };
      }
    }

    return {
      startDate: timeRange.startDate,
      endDate: timeRange.endDate,
    };
  }

  async getCSVStream(filePath: string, user: User): Promise<Readable> {
    // Verify user has access to this file
    const jobId = path.basename(filePath).split('_')[1];
    const exportJob = await dashboardService.getExportJob(jobId, user);
    
    if (!exportJob || exportJob.filePath !== filePath) {
      throw new Error('Access denied to export file');
    }

    if (exportJob.status !== ExportStatus.COMPLETED) {
      throw new Error('Export is not ready for download');
    }

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      throw new Error('Export file not found');
    }

    return fs.createReadStream(filePath);
  }

  async cleanupExpiredExports(): Promise<void> {
    try {
      const expiredJobs = await db.query(`
        SELECT id, file_path 
        FROM export_jobs 
        WHERE expires_at < NOW() AND file_path IS NOT NULL
      `);

      for (const job of expiredJobs) {
        if (fs.existsSync(job.file_path)) {
          fs.unlinkSync(job.file_path);
        }
        
        await db.query(`
          DELETE FROM export_jobs 
          WHERE id = $1
        `, [job.id]);
      }

      console.log(`🧹 Cleaned up ${expiredJobs.length} expired export files`);
    } catch (error) {
      console.error('Error cleaning up expired exports:', error);
    }
  }
}

export const exportService = new ExportService();
export default exportService;
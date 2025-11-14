import * as fs from 'fs/promises';
import * as path from 'path';
import * as PDFDocument from 'pdfkit';
import OpenAI from 'openai';
import { db } from '../config/database';
import { analyticsService } from './analytics.service';
import { notificationService } from './notification.service';
import config from '../config';
import logger from '../utils/logger';
import {
  Report,
  ReportGeneration,
  ReportGenerationRequest,
  ChartSnapshot,
  ChannelConfig,
} from '../types';

export class ReportsService {
  private openai: OpenAI | null = null;

  constructor() {
    if (config.openai.apiKey) {
      this.openai = new OpenAI({
        apiKey: config.openai.apiKey,
      });
    }
  }

  async createReport(reportData: Partial<Report>, userId: string): Promise<Report> {
    const query = `
      INSERT INTO reports (
        name, description, report_type, schedule,
        metrics, date_range_type, include_charts, include_narrative,
        facility_id, channels, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      reportData.name,
      reportData.description,
      reportData.reportType,
      reportData.schedule,
      JSON.stringify(reportData.metrics || []),
      reportData.dateRangeType,
      reportData.includeCharts !== false,
      reportData.includeNarrative !== false,
      reportData.facilityId,
      JSON.stringify(reportData.channels || []),
      reportData.enabled !== false,
      userId,
    ];

    const result = await db.queryOne<any>(query, values);
    return this.mapReportFromDB(result);
  }

  async getReport(id: string): Promise<Report | null> {
    const query = 'SELECT * FROM reports WHERE id = $1';
    const result = await db.queryOne<any>(query, [id]);
    return result ? this.mapReportFromDB(result) : null;
  }

  async listReports(filters?: { enabled?: boolean; facilityId?: string }): Promise<Report[]> {
    let query = 'SELECT * FROM reports WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters?.enabled !== undefined) {
      query += ` AND enabled = $${paramIndex++}`;
      values.push(filters.enabled);
    }

    if (filters?.facilityId) {
      query += ` AND (facility_id = $${paramIndex++} OR facility_id IS NULL)`;
      values.push(filters.facilityId);
    }

    query += ' ORDER BY created_at DESC';

    const results = await db.query<any>(query, values);
    return results.map(r => this.mapReportFromDB(r));
  }

  async updateReport(id: string, reportData: Partial<Report>): Promise<Report | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (reportData.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(reportData.name);
    }
    if (reportData.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(reportData.enabled);
    }
    if (reportData.channels !== undefined) {
      updates.push(`channels = $${paramIndex++}`);
      values.push(JSON.stringify(reportData.channels));
    }

    if (updates.length === 0) {
      return this.getReport(id);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(id);
    const query = `
      UPDATE reports 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.queryOne<any>(query, values);
    return result ? this.mapReportFromDB(result) : null;
  }

  async deleteReport(id: string): Promise<boolean> {
    const query = 'DELETE FROM reports WHERE id = $1';
    await db.query(query, [id]);
    return true;
  }

  async generateReport(request: ReportGenerationRequest): Promise<ReportGeneration> {
    let report: Report | null = null;

    if (request.reportId) {
      report = await this.getReport(request.reportId);
      if (!report) {
        throw new Error(`Report not found: ${request.reportId}`);
      }
    }

    // Calculate date range
    const { startDate, endDate } = this.calculateDateRange(
      request.dateRangeStart,
      request.dateRangeEnd,
      report?.dateRangeType
    );

    // Fetch analytics data
    const metrics = request.metrics || report?.metrics || ['revenue', 'pipeline_count', 'compliance_rate'];
    const kpis = await analyticsService.getKPIs({
      startDate,
      endDate,
      facilityId: request.facilityId || report?.facilityId,
    });

    // Generate chart snapshots
    const charts = await this.generateChartSnapshots(kpis, metrics);

    // Generate narrative using LLM
    let narrative = '';
    if (report?.includeNarrative !== false) {
      narrative = await this.generateNarrative(kpis, metrics, startDate, endDate);
    }

    // Create PDF
    const pdfPath = await this.generatePDF(
      report?.name || 'Analytics Report',
      narrative,
      charts,
      startDate,
      endDate
    );

    // Save generation record
    const generation = await this.saveReportGeneration(
      request.reportId,
      startDate,
      endDate,
      narrative,
      charts,
      pdfPath
    );

    // Send notifications if channels provided
    const channels = request.deliveryChannels || report?.channels || [];
    if (channels.length > 0) {
      await this.sendReportNotifications(generation, channels, pdfPath);
    }

    return generation;
  }

  private calculateDateRange(
    startDate?: string,
    endDate?: string,
    dateRangeType?: string
  ): { startDate: string; endDate: string } {
    if (startDate && endDate) {
      return { startDate, endDate };
    }

    const now = new Date();
    let start = new Date();
    let end = new Date();

    switch (dateRangeType) {
      case 'last_week':
        start.setDate(now.getDate() - 7);
        break;
      case 'last_month':
        start.setMonth(now.getMonth() - 1);
        break;
      default:
        start.setDate(now.getDate() - 7);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  private async generateChartSnapshots(kpis: any, metrics: string[]): Promise<ChartSnapshot[]> {
    const charts: ChartSnapshot[] = [];

    if (metrics.includes('revenue')) {
      charts.push({
        type: 'revenue',
        title: 'Revenue Overview',
        data: {
          total: kpis.revenue.totalRevenue,
          average: kpis.revenue.averageRevenuePerPlacement,
          byFacility: kpis.revenue.revenueByFacility,
          byMonth: kpis.revenue.revenueByMonth,
        },
      });
    }

    if (metrics.includes('pipeline_count')) {
      charts.push({
        type: 'pipeline',
        title: 'Pipeline Metrics',
        data: {
          count: kpis.pipelineCount,
          timeToFill: kpis.timeToFill,
        },
      });
    }

    if (metrics.includes('compliance_rate')) {
      charts.push({
        type: 'compliance',
        title: 'Compliance Status',
        data: {
          rate: kpis.complianceStatus.complianceRate,
          total: kpis.complianceStatus.totalApplications,
          compliant: kpis.complianceStatus.compliantApplications,
          violations: kpis.complianceStatus.violations,
        },
      });
    }

    if (metrics.includes('outreach_response_rate')) {
      charts.push({
        type: 'outreach',
        title: 'Outreach Effectiveness',
        data: {
          total: kpis.outreachEffectiveness.totalOutreach,
          responseRate: kpis.outreachEffectiveness.responseRate,
          conversionRate: kpis.outreachEffectiveness.conversionRate,
          channels: kpis.outreachEffectiveness.effectiveChannels,
        },
      });
    }

    return charts;
  }

  private async generateNarrative(
    kpis: any,
    metrics: string[],
    startDate: string,
    endDate: string
  ): Promise<string> {
    if (!this.openai) {
      return this.generateBasicNarrative(kpis, metrics, startDate, endDate);
    }

    try {
      const prompt = this.buildNarrativePrompt(kpis, metrics, startDate, endDate);

      const completion = await this.openai.chat.completions.create({
        model: config.openai.model,
        messages: [
          {
            role: 'system',
            content: 'You are an expert data analyst writing an executive summary of analytics data. Be concise, insightful, and highlight key trends and actionable recommendations.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        max_tokens: config.openai.maxTokens,
        temperature: 0.7,
      });

      return completion.choices[0].message.content || this.generateBasicNarrative(kpis, metrics, startDate, endDate);
    } catch (error) {
      logger.error('Failed to generate LLM narrative', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.generateBasicNarrative(kpis, metrics, startDate, endDate);
    }
  }

  private buildNarrativePrompt(kpis: any, metrics: string[], startDate: string, endDate: string): string {
    let prompt = `Generate an executive summary for the analytics report from ${startDate} to ${endDate}.\n\n`;
    prompt += 'Key Metrics:\n';

    if (metrics.includes('revenue')) {
      prompt += `- Total Revenue: $${kpis.revenue.totalRevenue.toLocaleString()}\n`;
      prompt += `- Average Revenue per Placement: $${kpis.revenue.averageRevenuePerPlacement.toLocaleString()}\n`;
    }

    if (metrics.includes('pipeline_count')) {
      prompt += `- Pipeline Count: ${kpis.pipelineCount}\n`;
      prompt += `- Average Time to Fill: ${kpis.timeToFill} days\n`;
    }

    if (metrics.includes('compliance_rate')) {
      prompt += `- Compliance Rate: ${kpis.complianceStatus.complianceRate}%\n`;
      prompt += `- Total Applications: ${kpis.complianceStatus.totalApplications}\n`;
    }

    if (metrics.includes('outreach_response_rate')) {
      prompt += `- Outreach Response Rate: ${kpis.outreachEffectiveness.responseRate}%\n`;
      prompt += `- Conversion Rate: ${kpis.outreachEffectiveness.conversionRate}%\n`;
    }

    prompt += '\nProvide insights on trends, performance, and actionable recommendations.';

    return prompt;
  }

  private generateBasicNarrative(kpis: any, metrics: string[], startDate: string, endDate: string): string {
    let narrative = `Analytics Report: ${startDate} to ${endDate}\n\n`;

    narrative += 'Executive Summary:\n\n';

    if (metrics.includes('revenue')) {
      narrative += `Revenue Performance: Generated $${kpis.revenue.totalRevenue.toLocaleString()} in total revenue `;
      narrative += `with an average of $${kpis.revenue.averageRevenuePerPlacement.toLocaleString()} per placement.\n\n`;
    }

    if (metrics.includes('pipeline_count')) {
      narrative += `Pipeline Metrics: Currently managing ${kpis.pipelineCount} candidates in the pipeline `;
      narrative += `with an average time to fill of ${kpis.timeToFill} days.\n\n`;
    }

    if (metrics.includes('compliance_rate')) {
      narrative += `Compliance Status: Achieved a ${kpis.complianceStatus.complianceRate}% compliance rate `;
      narrative += `with ${kpis.complianceStatus.compliantApplications} compliant applications out of ${kpis.complianceStatus.totalApplications} total.\n\n`;
    }

    if (metrics.includes('outreach_response_rate')) {
      narrative += `Outreach Effectiveness: Achieved a ${kpis.outreachEffectiveness.responseRate}% response rate `;
      narrative += `and ${kpis.outreachEffectiveness.conversionRate}% conversion rate from ${kpis.outreachEffectiveness.totalOutreach} outreach attempts.\n\n`;
    }

    return narrative;
  }

  private async generatePDF(
    title: string,
    narrative: string,
    charts: ChartSnapshot[],
    startDate: string,
    endDate: string
  ): Promise<string> {
    // Ensure storage directory exists
    await fs.mkdir(config.reports.storageDir, { recursive: true });

    const filename = `report-${Date.now()}.pdf`;
    const filepath = path.join(config.reports.storageDir, filename);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const stream = require('fs').createWriteStream(filepath);

      doc.pipe(stream);

      // Title
      doc.fontSize(24).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Report Period: ${startDate} to ${endDate}`, { align: 'center' });
      doc.moveDown(2);

      // Narrative
      doc.fontSize(16).text('Executive Summary', { underline: true });
      doc.moveDown();
      doc.fontSize(11).text(narrative, { align: 'justify' });
      doc.moveDown(2);

      // Charts data
      doc.fontSize(16).text('Key Metrics', { underline: true });
      doc.moveDown();

      for (const chart of charts) {
        doc.fontSize(14).text(chart.title, { underline: true });
        doc.moveDown(0.5);
        doc.fontSize(10).text(JSON.stringify(chart.data, null, 2), { width: 500 });
        doc.moveDown(2);
      }

      // Footer
      doc.fontSize(8).text(
        `Generated on ${new Date().toISOString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => resolve(filepath));
      stream.on('error', reject);
    });
  }

  private async saveReportGeneration(
    reportId: string | undefined,
    startDate: string,
    endDate: string,
    narrative: string,
    charts: ChartSnapshot[],
    pdfPath: string
  ): Promise<ReportGeneration> {
    const stats = await fs.stat(pdfPath);

    const query = `
      INSERT INTO report_generations (
        report_id, date_range_start, date_range_end,
        narrative, charts, pdf_url, status, file_size_bytes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const result = await db.queryOne<any>(query, [
      reportId,
      startDate,
      endDate,
      narrative,
      JSON.stringify(charts),
      pdfPath,
      'pending',
      stats.size,
    ]);

    if (reportId) {
      await db.query('UPDATE reports SET last_generated_at = NOW() WHERE id = $1', [reportId]);
    }

    return this.mapGenerationFromDB(result);
  }

  private async sendReportNotifications(
    generation: ReportGeneration,
    channels: ChannelConfig[],
    pdfPath: string
  ): Promise<void> {
    const pdfBuffer = await fs.readFile(pdfPath);
    const recipients: string[] = [];

    for (const channel of channels) {
      try {
        const attachments = [
          {
            filename: path.basename(pdfPath),
            content: pdfBuffer,
            contentType: 'application/pdf',
          },
        ];

        await notificationService.send(
          channel,
          'Weekly Analytics Report',
          generation.narrative || 'Your weekly analytics report is attached.',
          attachments
        );

        if (channel.type === 'email') {
          recipients.push(...channel.recipients);
        }

        logger.info('Report notification sent', {
          generationId: generation.id,
          channel: channel.type,
        });
      } catch (error) {
        logger.error('Failed to send report notification', {
          generationId: generation.id,
          channel: channel.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update generation status
    await db.query(
      'UPDATE report_generations SET status = $1, sent_at = NOW(), recipients = $2 WHERE id = $3',
      ['sent', JSON.stringify(recipients), generation.id]
    );
  }

  async getReportGeneration(id: string): Promise<ReportGeneration | null> {
    const query = 'SELECT * FROM report_generations WHERE id = $1';
    const result = await db.queryOne<any>(query, [id]);
    return result ? this.mapGenerationFromDB(result) : null;
  }

  async listReportGenerations(reportId: string, limit = 20): Promise<ReportGeneration[]> {
    const query = `
      SELECT * FROM report_generations
      WHERE report_id = $1
      ORDER BY generated_at DESC
      LIMIT $2
    `;

    const results = await db.query<any>(query, [reportId, limit]);
    return results.map(r => this.mapGenerationFromDB(r));
  }

  private mapReportFromDB(row: any): Report {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      reportType: row.report_type,
      schedule: row.schedule,
      metrics: row.metrics,
      dateRangeType: row.date_range_type,
      includeCharts: row.include_charts,
      includeNarrative: row.include_narrative,
      facilityId: row.facility_id,
      channels: row.channels,
      enabled: row.enabled,
      lastGeneratedAt: row.last_generated_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  }

  private mapGenerationFromDB(row: any): ReportGeneration {
    return {
      id: row.id,
      reportId: row.report_id,
      generatedAt: row.generated_at,
      dateRangeStart: row.date_range_start,
      dateRangeEnd: row.date_range_end,
      narrative: row.narrative,
      charts: row.charts,
      pdfUrl: row.pdf_url,
      status: row.status,
      sentAt: row.sent_at,
      recipients: row.recipients || [],
      errorMessage: row.error_message,
      metadata: row.metadata,
      fileSizeBytes: row.file_size_bytes,
    };
  }
}

export const reportsService = new ReportsService();

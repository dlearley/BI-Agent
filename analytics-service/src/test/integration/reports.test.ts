import request from 'supertest';
import app from '../../test-server';
import { db } from '../../config/database';
import { reportsService } from '../../services/reports.service';
import { notificationService } from '../../services/notification.service';
import fs from 'fs/promises';
import path from 'path';

// Mock notification service and OpenAI
jest.mock('../../services/notification.service');
jest.mock('openai');

describe('Reports API Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM report_generations');
    await db.query('DELETE FROM reports');
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('POST /api/v1/reports', () => {
    it('should create a weekly briefing report', async () => {
      const reportData = {
        name: 'Weekly Analytics Briefing',
        description: 'Automated weekly report with insights',
        reportType: 'weekly_briefing',
        schedule: '0 9 * * 1',
        metrics: ['revenue', 'pipeline_count', 'compliance_rate'],
        dateRangeType: 'last_week',
        includeCharts: true,
        includeNarrative: true,
        channels: [
          {
            type: 'email',
            recipients: ['exec@example.com'],
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/reports')
        .send(reportData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: reportData.name,
        reportType: reportData.reportType,
        metrics: reportData.metrics,
        enabled: true,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create a monthly summary report', async () => {
      const reportData = {
        name: 'Monthly Summary',
        reportType: 'monthly_summary',
        schedule: '0 9 1 * *',
        metrics: ['revenue', 'outreach_response_rate'],
        dateRangeType: 'last_month',
        includeCharts: true,
        includeNarrative: true,
        channels: [
          {
            type: 'slack',
            webhookUrl: 'https://hooks.slack.com/test',
            channel: '#reports',
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/reports')
        .send(reportData)
        .expect(201);

      expect(response.body.reportType).toBe(reportData.reportType);
    });
  });

  describe('GET /api/v1/reports', () => {
    it('should list all reports', async () => {
      await reportsService.createReport(
        {
          name: 'Test Report',
          reportType: 'weekly_briefing',
          schedule: '0 9 * * 1',
          metrics: ['revenue'],
          dateRangeType: 'last_week',
          channels: [],
        },
        'test@example.com'
      );

      const response = await request(app)
        .get('/api/v1/reports')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter reports by enabled status', async () => {
      await reportsService.createReport(
        {
          name: 'Enabled Report',
          reportType: 'weekly_briefing',
          schedule: '0 9 * * 1',
          metrics: ['revenue'],
          dateRangeType: 'last_week',
          channels: [],
          enabled: true,
        },
        'test@example.com'
      );

      await reportsService.createReport(
        {
          name: 'Disabled Report',
          reportType: 'weekly_briefing',
          schedule: '0 9 * * 1',
          metrics: ['revenue'],
          dateRangeType: 'last_week',
          channels: [],
          enabled: false,
        },
        'test@example.com'
      );

      const response = await request(app)
        .get('/api/v1/reports?enabled=true')
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].enabled).toBe(true);
    });
  });

  describe('GET /api/v1/reports/:id', () => {
    it('should get report by id', async () => {
      const report = await reportsService.createReport(
        {
          name: 'Test Report',
          reportType: 'weekly_briefing',
          schedule: '0 9 * * 1',
          metrics: ['revenue'],
          dateRangeType: 'last_week',
          channels: [],
        },
        'test@example.com'
      );

      const response = await request(app)
        .get(`/api/v1/reports/${report.id}`)
        .expect(200);

      expect(response.body.id).toBe(report.id);
      expect(response.body.name).toBe(report.name);
    });

    it('should return 404 for non-existent report', async () => {
      await request(app)
        .get('/api/v1/reports/non-existent-id')
        .expect(404);
    });
  });

  describe('PUT /api/v1/reports/:id', () => {
    it('should update report', async () => {
      const report = await reportsService.createReport(
        {
          name: 'Test Report',
          reportType: 'weekly_briefing',
          schedule: '0 9 * * 1',
          metrics: ['revenue'],
          dateRangeType: 'last_week',
          channels: [],
        },
        'test@example.com'
      );

      const updates = {
        name: 'Updated Report Name',
        enabled: false,
      };

      const response = await request(app)
        .put(`/api/v1/reports/${report.id}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.enabled).toBe(updates.enabled);
    });
  });

  describe('DELETE /api/v1/reports/:id', () => {
    it('should delete report', async () => {
      const report = await reportsService.createReport(
        {
          name: 'Test Report',
          reportType: 'weekly_briefing',
          schedule: '0 9 * * 1',
          metrics: ['revenue'],
          dateRangeType: 'last_week',
          channels: [],
        },
        'test@example.com'
      );

      await request(app)
        .delete(`/api/v1/reports/${report.id}`)
        .expect(204);

      const deletedReport = await reportsService.getReport(report.id);
      expect(deletedReport).toBeNull();
    });
  });

  describe('POST /api/v1/reports/send-now', () => {
    it('should generate and send report immediately', async () => {
      const mockSend = notificationService.send as jest.MockedFunction<typeof notificationService.send>;
      mockSend.mockResolvedValue();

      const report = await reportsService.createReport(
        {
          name: 'Test Report',
          reportType: 'weekly_briefing',
          schedule: 'manual',
          metrics: ['revenue', 'pipeline_count'],
          dateRangeType: 'last_week',
          channels: [
            {
              type: 'email',
              recipients: ['test@example.com'],
            },
          ],
        },
        'test@example.com'
      );

      const response = await request(app)
        .post('/api/v1/reports/send-now')
        .send({
          reportId: report.id,
        })
        .expect(200);

      expect(response.body.reportId).toBe(report.id);
      expect(response.body.narrative).toBeDefined();
      expect(response.body.charts).toBeDefined();
      expect(response.body.pdfUrl).toBeDefined();

      // Verify PDF was created
      const pdfExists = await fs.access(response.body.pdfUrl).then(() => true).catch(() => false);
      expect(pdfExists).toBe(true);

      // Verify notification was sent
      expect(mockSend).toHaveBeenCalled();

      // Cleanup
      await fs.unlink(response.body.pdfUrl).catch(() => {});
    });

    it('should generate report with custom date range', async () => {
      const mockSend = notificationService.send as jest.MockedFunction<typeof notificationService.send>;
      mockSend.mockResolvedValue();

      const response = await request(app)
        .post('/api/v1/reports/send-now')
        .send({
          dateRangeStart: '2024-01-01',
          dateRangeEnd: '2024-01-07',
          metrics: ['revenue'],
          deliveryChannels: [
            {
              type: 'email',
              recipients: ['test@example.com'],
            },
          ],
        })
        .expect(200);

      expect(response.body.dateRangeStart).toBe('2024-01-01');
      expect(response.body.dateRangeEnd).toBe('2024-01-07');

      // Cleanup
      if (response.body.pdfUrl) {
        await fs.unlink(response.body.pdfUrl).catch(() => {});
      }
    });
  });

  describe('GET /api/v1/reports/:id/generations', () => {
    it('should list report generations', async () => {
      const report = await reportsService.createReport(
        {
          name: 'Test Report',
          reportType: 'weekly_briefing',
          schedule: 'manual',
          metrics: ['revenue'],
          dateRangeType: 'last_week',
          channels: [],
        },
        'test@example.com'
      );

      // Generate a report
      await reportsService.generateReport({ reportId: report.id });

      const response = await request(app)
        .get(`/api/v1/reports/${report.id}/generations`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);

      // Cleanup PDFs
      for (const generation of response.body) {
        if (generation.pdfUrl) {
          await fs.unlink(generation.pdfUrl).catch(() => {});
        }
      }
    });
  });

  describe('Report Generation Integration', () => {
    it('should generate PDF with charts and narrative', async () => {
      const generation = await reportsService.generateReport({
        dateRangeStart: '2024-01-01',
        dateRangeEnd: '2024-01-07',
        metrics: ['revenue', 'pipeline_count', 'compliance_rate'],
      });

      expect(generation.narrative).toBeDefined();
      expect(generation.narrative.length).toBeGreaterThan(0);
      expect(generation.charts.length).toBeGreaterThan(0);
      expect(generation.pdfUrl).toBeDefined();

      // Verify PDF exists and has content
      const stats = await fs.stat(generation.pdfUrl!);
      expect(stats.size).toBeGreaterThan(0);
      expect(generation.fileSizeBytes).toBe(stats.size);

      // Cleanup
      await fs.unlink(generation.pdfUrl!).catch(() => {});
    });

    it('should send report via multiple channels', async () => {
      const mockSend = notificationService.send as jest.MockedFunction<typeof notificationService.send>;
      mockSend.mockResolvedValue();

      const channels = [
        {
          type: 'email' as const,
          recipients: ['exec@example.com'],
        },
        {
          type: 'slack' as const,
          webhookUrl: 'https://hooks.slack.com/test',
          channel: '#reports',
        },
      ];

      const generation = await reportsService.generateReport({
        dateRangeStart: '2024-01-01',
        dateRangeEnd: '2024-01-07',
        metrics: ['revenue'],
        deliveryChannels: channels,
      });

      // Verify notifications were sent to all channels
      expect(mockSend).toHaveBeenCalledTimes(2);

      // Cleanup
      if (generation.pdfUrl) {
        await fs.unlink(generation.pdfUrl).catch(() => {});
      }
    });

    it('should include chart snapshots in report', async () => {
      const generation = await reportsService.generateReport({
        dateRangeStart: '2024-01-01',
        dateRangeEnd: '2024-01-07',
        metrics: ['revenue', 'pipeline_count', 'compliance_rate', 'outreach_response_rate'],
      });

      expect(generation.charts.length).toBe(4);

      const chartTypes = generation.charts.map(c => c.type);
      expect(chartTypes).toContain('revenue');
      expect(chartTypes).toContain('pipeline');
      expect(chartTypes).toContain('compliance');
      expect(chartTypes).toContain('outreach');

      // Each chart should have data
      generation.charts.forEach(chart => {
        expect(chart.title).toBeDefined();
        expect(chart.data).toBeDefined();
      });

      // Cleanup
      if (generation.pdfUrl) {
        await fs.unlink(generation.pdfUrl).catch(() => {});
      }
    });
  });
});

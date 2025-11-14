import request from 'supertest';
import app from '../../test-server';
import { db } from '../../config/database';
import { alertsService } from '../../services/alerts.service';
import { notificationService } from '../../services/notification.service';
import { AlertType } from '../../types';

// Mock notification service
jest.mock('../../services/notification.service');

describe('Alerts API Integration Tests', () => {
  beforeEach(async () => {
    // Clean up test data
    await db.query('DELETE FROM alert_notifications');
    await db.query('DELETE FROM alerts');
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await db.close();
  });

  describe('POST /api/v1/alerts', () => {
    it('should create a threshold alert', async () => {
      const alertData = {
        name: 'High Revenue Alert',
        description: 'Alert when revenue exceeds threshold',
        metric: 'revenue',
        alertType: AlertType.THRESHOLD,
        thresholdValue: 100000,
        thresholdOperator: '>',
        evaluationFrequency: 'daily',
        evaluationSchedule: '0 9 * * *',
        channels: [
          {
            type: 'slack',
            webhookUrl: 'https://hooks.slack.com/test',
            channel: '#alerts',
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .send(alertData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: alertData.name,
        metric: alertData.metric,
        alertType: alertData.alertType,
        thresholdValue: alertData.thresholdValue,
        enabled: true,
      });
      expect(response.body.id).toBeDefined();
    });

    it('should create a percent change alert', async () => {
      const alertData = {
        name: 'Revenue Drop Alert',
        metric: 'revenue',
        alertType: AlertType.PERCENT_CHANGE,
        percentChangeValue: 10,
        percentChangePeriod: 'weekly',
        percentChangeDirection: 'decrease',
        evaluationFrequency: 'daily',
        evaluationSchedule: '0 9 * * *',
        channels: [
          {
            type: 'email',
            recipients: ['admin@example.com'],
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .send(alertData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: alertData.name,
        alertType: alertData.alertType,
        percentChangeValue: alertData.percentChangeValue,
      });
    });

    it('should create an anomaly detection alert', async () => {
      const alertData = {
        name: 'Compliance Anomaly Alert',
        metric: 'compliance_rate',
        alertType: AlertType.ANOMALY,
        anomalySensitivity: 'high',
        anomalyLookbackDays: 30,
        evaluationFrequency: 'hourly',
        evaluationSchedule: '0 * * * *',
        channels: [
          {
            type: 'webhook',
            url: 'https://example.com/webhook',
            method: 'POST',
          },
        ],
      };

      const response = await request(app)
        .post('/api/v1/alerts')
        .send(alertData)
        .expect(201);

      expect(response.body).toMatchObject({
        name: alertData.name,
        alertType: alertData.alertType,
        anomalySensitivity: alertData.anomalySensitivity,
      });
    });
  });

  describe('GET /api/v1/alerts', () => {
    it('should list all alerts', async () => {
      // Create test alerts
      await alertsService.createAlert(
        {
          name: 'Test Alert 1',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 10000,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [],
        },
        'test@example.com'
      );

      const response = await request(app)
        .get('/api/v1/alerts')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
    });

    it('should filter alerts by enabled status', async () => {
      await alertsService.createAlert(
        {
          name: 'Enabled Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 10000,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [],
          enabled: true,
        },
        'test@example.com'
      );

      await alertsService.createAlert(
        {
          name: 'Disabled Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 10000,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [],
          enabled: false,
        },
        'test@example.com'
      );

      const response = await request(app)
        .get('/api/v1/alerts?enabled=true')
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].enabled).toBe(true);
    });
  });

  describe('GET /api/v1/alerts/:id', () => {
    it('should get alert by id', async () => {
      const alert = await alertsService.createAlert(
        {
          name: 'Test Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 10000,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [],
        },
        'test@example.com'
      );

      const response = await request(app)
        .get(`/api/v1/alerts/${alert.id}`)
        .expect(200);

      expect(response.body.id).toBe(alert.id);
      expect(response.body.name).toBe(alert.name);
    });

    it('should return 404 for non-existent alert', async () => {
      await request(app)
        .get('/api/v1/alerts/non-existent-id')
        .expect(404);
    });
  });

  describe('PUT /api/v1/alerts/:id', () => {
    it('should update alert', async () => {
      const alert = await alertsService.createAlert(
        {
          name: 'Test Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 10000,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [],
        },
        'test@example.com'
      );

      const updates = {
        name: 'Updated Alert Name',
        thresholdValue: 20000,
      };

      const response = await request(app)
        .put(`/api/v1/alerts/${alert.id}`)
        .send(updates)
        .expect(200);

      expect(response.body.name).toBe(updates.name);
      expect(response.body.thresholdValue).toBe(updates.thresholdValue);
    });
  });

  describe('DELETE /api/v1/alerts/:id', () => {
    it('should delete alert', async () => {
      const alert = await alertsService.createAlert(
        {
          name: 'Test Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 10000,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [],
        },
        'test@example.com'
      );

      await request(app)
        .delete(`/api/v1/alerts/${alert.id}`)
        .expect(204);

      // Verify alert is deleted
      const deletedAlert = await alertsService.getAlert(alert.id);
      expect(deletedAlert).toBeNull();
    });
  });

  describe('POST /api/v1/alerts/:id/test', () => {
    it('should evaluate alert and send notification on trigger', async () => {
      // Mock notification service
      const mockSend = notificationService.send as jest.MockedFunction<typeof notificationService.send>;
      mockSend.mockResolvedValue();

      const alert = await alertsService.createAlert(
        {
          name: 'Test Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 0, // Low threshold to ensure trigger
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [
            {
              type: 'slack',
              webhookUrl: 'https://hooks.slack.com/test',
              channel: '#alerts',
            },
          ],
        },
        'test@example.com'
      );

      const response = await request(app)
        .post(`/api/v1/alerts/${alert.id}/test`)
        .expect(200);

      expect(response.body.alertId).toBe(alert.id);
      expect(response.body.triggered).toBeDefined();

      // If triggered, verify notification was sent
      if (response.body.triggered) {
        expect(mockSend).toHaveBeenCalled();
      }
    });
  });

  describe('GET /api/v1/alerts/:id/notifications', () => {
    it('should get notification history for alert', async () => {
      const alert = await alertsService.createAlert(
        {
          name: 'Test Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 10000,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [],
        },
        'test@example.com'
      );

      const response = await request(app)
        .get(`/api/v1/alerts/${alert.id}/notifications`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });

  describe('Alert Notification Integration', () => {
    it('should send Slack notification when alert triggers', async () => {
      const mockSend = notificationService.send as jest.MockedFunction<typeof notificationService.send>;
      mockSend.mockResolvedValue();

      const slackChannel = {
        type: 'slack' as const,
        webhookUrl: 'https://hooks.slack.com/test',
        channel: '#alerts',
        username: 'Analytics Bot',
      };

      const alert = await alertsService.createAlert(
        {
          name: 'Revenue Spike Alert',
          metric: 'revenue',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 0,
          thresholdOperator: '>',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [slackChannel],
        },
        'test@example.com'
      );

      await alertsService.evaluateAlert(alert.id);

      // Verify Slack notification was attempted
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'slack' }),
        expect.any(String),
        expect.any(String)
      );
    });

    it('should send email notification when alert triggers', async () => {
      const mockSend = notificationService.send as jest.MockedFunction<typeof notificationService.send>;
      mockSend.mockResolvedValue();

      const emailChannel = {
        type: 'email' as const,
        recipients: ['admin@example.com', 'team@example.com'],
        subject: 'Alert Triggered',
      };

      const alert = await alertsService.createAlert(
        {
          name: 'Compliance Alert',
          metric: 'compliance_rate',
          alertType: AlertType.THRESHOLD,
          thresholdValue: 100,
          thresholdOperator: '<',
          evaluationFrequency: 'daily',
          evaluationSchedule: '0 9 * * *',
          channels: [emailChannel],
        },
        'test@example.com'
      );

      await alertsService.evaluateAlert(alert.id);

      // Verify email notification was attempted
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'email' }),
        expect.any(String),
        expect.any(String)
      );
    });
  });
});

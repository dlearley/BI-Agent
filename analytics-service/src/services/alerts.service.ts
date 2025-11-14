import { db } from '../config/database';
import { redis } from '../config/redis';
import { notificationService } from './notification.service';
import { mlService } from './ml.service';
import { analyticsService } from './analytics.service';
import logger from '../utils/logger';
import {
  Alert,
  AlertType,
  AlertNotification,
  AlertEvaluationResult,
  ChannelConfig,
} from '../types';

export class AlertsService {
  async createAlert(alertData: Partial<Alert>, userId: string): Promise<Alert> {
    const query = `
      INSERT INTO alerts (
        name, description, metric, alert_type, 
        threshold_value, threshold_operator,
        percent_change_value, percent_change_period, percent_change_direction,
        anomaly_sensitivity, anomaly_lookback_days,
        evaluation_frequency, evaluation_schedule,
        facility_id, date_range_start, date_range_end,
        channels, enabled, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
    `;

    const values = [
      alertData.name,
      alertData.description,
      alertData.metric,
      alertData.alertType,
      alertData.thresholdValue,
      alertData.thresholdOperator,
      alertData.percentChangeValue,
      alertData.percentChangePeriod,
      alertData.percentChangeDirection,
      alertData.anomalySensitivity,
      alertData.anomalyLookbackDays || 30,
      alertData.evaluationFrequency,
      alertData.evaluationSchedule,
      alertData.facilityId,
      alertData.dateRangeStart,
      alertData.dateRangeEnd,
      JSON.stringify(alertData.channels || []),
      alertData.enabled !== false,
      userId,
    ];

    const result = await db.queryOne<any>(query, values);
    return this.mapAlertFromDB(result);
  }

  async getAlert(id: string): Promise<Alert | null> {
    const query = 'SELECT * FROM alerts WHERE id = $1';
    const result = await db.queryOne<any>(query, [id]);
    return result ? this.mapAlertFromDB(result) : null;
  }

  async listAlerts(filters?: { enabled?: boolean; facilityId?: string }): Promise<Alert[]> {
    let query = 'SELECT * FROM alerts WHERE 1=1';
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
    return results.map(r => this.mapAlertFromDB(r));
  }

  async updateAlert(id: string, alertData: Partial<Alert>): Promise<Alert | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (alertData.name !== undefined) {
      updates.push(`name = $${paramIndex++}`);
      values.push(alertData.name);
    }
    if (alertData.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(alertData.description);
    }
    if (alertData.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(alertData.enabled);
    }
    if (alertData.channels !== undefined) {
      updates.push(`channels = $${paramIndex++}`);
      values.push(JSON.stringify(alertData.channels));
    }
    if (alertData.thresholdValue !== undefined) {
      updates.push(`threshold_value = $${paramIndex++}`);
      values.push(alertData.thresholdValue);
    }
    if (alertData.evaluationSchedule !== undefined) {
      updates.push(`evaluation_schedule = $${paramIndex++}`);
      values.push(alertData.evaluationSchedule);
    }

    if (updates.length === 0) {
      return this.getAlert(id);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(new Date());

    values.push(id);
    const query = `
      UPDATE alerts 
      SET ${updates.join(', ')} 
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await db.queryOne<any>(query, values);
    return result ? this.mapAlertFromDB(result) : null;
  }

  async deleteAlert(id: string): Promise<boolean> {
    const query = 'DELETE FROM alerts WHERE id = $1';
    await db.query(query, [id]);
    return true;
  }

  async evaluateAlert(alertId: string): Promise<AlertEvaluationResult> {
    const alert = await this.getAlert(alertId);
    if (!alert) {
      throw new Error(`Alert not found: ${alertId}`);
    }

    if (!alert.enabled) {
      return {
        alertId,
        triggered: false,
        currentValue: 0,
        message: 'Alert is disabled',
        timestamp: new Date(),
      };
    }

    // Get current metric value
    const currentValue = await this.getCurrentMetricValue(alert);

    let triggered = false;
    let message = '';
    let previousValue: number | undefined;
    let thresholdBreached: number | undefined;

    switch (alert.alertType) {
      case AlertType.THRESHOLD:
        const result = this.evaluateThreshold(currentValue, alert);
        triggered = result.triggered;
        message = result.message;
        thresholdBreached = alert.thresholdValue;
        break;

      case AlertType.PERCENT_CHANGE:
        const changeResult = await this.evaluatePercentChange(currentValue, alert);
        triggered = changeResult.triggered;
        message = changeResult.message;
        previousValue = changeResult.previousValue;
        thresholdBreached = changeResult.threshold;
        break;

      case AlertType.ANOMALY:
        const anomalyResult = await this.evaluateAnomaly(currentValue, alert);
        triggered = anomalyResult.triggered;
        message = anomalyResult.message;
        break;
    }

    // Update last evaluated timestamp
    await db.query('UPDATE alerts SET last_evaluated_at = NOW() WHERE id = $1', [alertId]);

    if (triggered) {
      await db.query('UPDATE alerts SET last_triggered_at = NOW() WHERE id = $1', [alertId]);
      await this.sendAlertNotifications(alert, currentValue, thresholdBreached, message);
    }

    return {
      alertId,
      triggered,
      currentValue,
      previousValue,
      thresholdBreached,
      message,
      timestamp: new Date(),
    };
  }

  private async getCurrentMetricValue(alert: Alert): Promise<number> {
    // Fetch the metric value from analytics
    const query: any = {
      facilityId: alert.facilityId,
      startDate: alert.dateRangeStart,
      endDate: alert.dateRangeEnd,
    };

    const kpis = await analyticsService.getKPIs(query);

    switch (alert.metric) {
      case 'revenue':
        return kpis.revenue.totalRevenue;
      case 'pipeline_count':
        return kpis.pipelineCount;
      case 'time_to_fill':
        return kpis.timeToFill;
      case 'compliance_rate':
        return kpis.complianceStatus.complianceRate;
      case 'outreach_response_rate':
        return kpis.outreachEffectiveness.responseRate;
      default:
        throw new Error(`Unknown metric: ${alert.metric}`);
    }
  }

  private evaluateThreshold(
    value: number,
    alert: Alert
  ): { triggered: boolean; message: string } {
    if (!alert.thresholdValue || !alert.thresholdOperator) {
      return { triggered: false, message: 'Invalid threshold configuration' };
    }

    let triggered = false;
    const operator = alert.thresholdOperator;
    const threshold = alert.thresholdValue;

    switch (operator) {
      case '>':
        triggered = value > threshold;
        break;
      case '<':
        triggered = value < threshold;
        break;
      case '>=':
        triggered = value >= threshold;
        break;
      case '<=':
        triggered = value <= threshold;
        break;
      case '=':
        triggered = value === threshold;
        break;
    }

    const message = triggered
      ? `Alert triggered: ${alert.metric} is ${value.toFixed(2)} (${operator} ${threshold})`
      : `Alert not triggered: ${alert.metric} is ${value.toFixed(2)}`;

    return { triggered, message };
  }

  private async evaluatePercentChange(
    currentValue: number,
    alert: Alert
  ): Promise<{ triggered: boolean; message: string; previousValue?: number; threshold?: number }> {
    if (!alert.percentChangeValue || !alert.percentChangePeriod) {
      return { triggered: false, message: 'Invalid percent change configuration' };
    }

    // Get previous value based on period
    const previousValue = await this.getPreviousValue(alert);
    const percentChange = ((currentValue - previousValue) / previousValue) * 100;
    const threshold = alert.percentChangeValue;

    let triggered = false;

    switch (alert.percentChangeDirection) {
      case 'increase':
        triggered = percentChange >= threshold;
        break;
      case 'decrease':
        triggered = percentChange <= -threshold;
        break;
      case 'any':
        triggered = Math.abs(percentChange) >= threshold;
        break;
    }

    const message = triggered
      ? `Alert triggered: ${alert.metric} changed by ${percentChange.toFixed(2)}% (threshold: ${threshold}%)`
      : `Alert not triggered: ${alert.metric} changed by ${percentChange.toFixed(2)}%`;

    return { triggered, message, previousValue, threshold };
  }

  private async getPreviousValue(alert: Alert): Promise<number> {
    // Calculate date range for previous period
    const now = new Date();
    let daysBack = 1;

    switch (alert.percentChangePeriod) {
      case 'daily':
        daysBack = 1;
        break;
      case 'weekly':
        daysBack = 7;
        break;
      case 'monthly':
        daysBack = 30;
        break;
    }

    const previousStart = new Date(now);
    previousStart.setDate(previousStart.getDate() - daysBack * 2);
    const previousEnd = new Date(now);
    previousEnd.setDate(previousEnd.getDate() - daysBack);

    const query: any = {
      facilityId: alert.facilityId,
      startDate: previousStart.toISOString().split('T')[0],
      endDate: previousEnd.toISOString().split('T')[0],
    };

    const kpis = await analyticsService.getKPIs(query);

    switch (alert.metric) {
      case 'revenue':
        return kpis.revenue.totalRevenue;
      case 'pipeline_count':
        return kpis.pipelineCount;
      case 'time_to_fill':
        return kpis.timeToFill;
      case 'compliance_rate':
        return kpis.complianceStatus.complianceRate;
      case 'outreach_response_rate':
        return kpis.outreachEffectiveness.responseRate;
      default:
        return 0;
    }
  }

  private async evaluateAnomaly(
    value: number,
    alert: Alert
  ): Promise<{ triggered: boolean; message: string }> {
    try {
      // Get historical data for anomaly detection
      const historicalData = await this.getHistoricalData(alert);

      if (historicalData.length < 7) {
        return { triggered: false, message: 'Insufficient historical data for anomaly detection' };
      }

      // Use ML service for anomaly detection
      const result = await mlService.detectAnomalies(historicalData);

      // Check if current value is an anomaly
      const lastAnomaly = result.anomalies[result.anomalies.length - 1];
      const triggered = lastAnomaly && lastAnomaly.severity !== 'low';

      const message = triggered
        ? `Anomaly detected: ${alert.metric} is ${value.toFixed(2)} (expected: ${lastAnomaly.expectedValue.toFixed(2)}, severity: ${lastAnomaly.severity})`
        : `No anomaly detected: ${alert.metric} is ${value.toFixed(2)}`;

      return { triggered, message };
    } catch (error) {
      logger.error('Anomaly detection failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: alert.id,
      });
      return { triggered: false, message: 'Anomaly detection failed' };
    }
  }

  private async getHistoricalData(alert: Alert): Promise<Array<{ timestamp: string; value: number }>> {
    const lookbackDays = alert.anomalyLookbackDays || 30;
    const data: Array<{ timestamp: string; value: number }> = [];

    for (let i = lookbackDays; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      try {
        const query: any = {
          facilityId: alert.facilityId,
          startDate: dateStr,
          endDate: dateStr,
        };

        const kpis = await analyticsService.getKPIs(query);
        let value = 0;

        switch (alert.metric) {
          case 'revenue':
            value = kpis.revenue.totalRevenue;
            break;
          case 'pipeline_count':
            value = kpis.pipelineCount;
            break;
          case 'time_to_fill':
            value = kpis.timeToFill;
            break;
          case 'compliance_rate':
            value = kpis.complianceStatus.complianceRate;
            break;
          case 'outreach_response_rate':
            value = kpis.outreachEffectiveness.responseRate;
            break;
        }

        data.push({ timestamp: dateStr, value });
      } catch (error) {
        logger.warn('Failed to fetch historical data point', { date: dateStr, error });
      }
    }

    return data;
  }

  private async sendAlertNotifications(
    alert: Alert,
    value: number,
    thresholdBreached: number | undefined,
    message: string
  ): Promise<void> {
    for (const channel of alert.channels) {
      try {
        const notificationId = await this.createNotificationRecord(
          alert.id,
          value,
          thresholdBreached,
          channel
        );

        await notificationService.send(
          channel,
          `Alert: ${alert.name}`,
          message
        );

        await this.updateNotificationStatus(notificationId, 'sent');
        logger.info('Alert notification sent', {
          alertId: alert.id,
          channel: channel.type,
        });
      } catch (error) {
        logger.error('Failed to send alert notification', {
          alertId: alert.id,
          channel: channel.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.updateNotificationStatus(
          await this.createNotificationRecord(alert.id, value, thresholdBreached, channel),
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
  }

  private async createNotificationRecord(
    alertId: string,
    value: number,
    thresholdBreached: number | undefined,
    channel: ChannelConfig
  ): Promise<string> {
    const query = `
      INSERT INTO alert_notifications (
        alert_id, metric_value, threshold_breached, 
        channel_type, channel_config, status
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id
    `;

    const result = await db.queryOne<{ id: string }>(query, [
      alertId,
      value,
      thresholdBreached,
      channel.type,
      JSON.stringify(channel),
      'pending',
    ]);

    return result!.id;
  }

  private async updateNotificationStatus(
    notificationId: string,
    status: 'sent' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const query = `
      UPDATE alert_notifications 
      SET status = $1, sent_at = NOW(), error_message = $2
      WHERE id = $3
    `;

    await db.query(query, [status, errorMessage, notificationId]);
  }

  async getNotificationHistory(alertId: string, limit = 50): Promise<AlertNotification[]> {
    const query = `
      SELECT * FROM alert_notifications
      WHERE alert_id = $1
      ORDER BY triggered_at DESC
      LIMIT $2
    `;

    const results = await db.query<any>(query, [alertId, limit]);
    return results.map(r => this.mapNotificationFromDB(r));
  }

  private mapAlertFromDB(row: any): Alert {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      metric: row.metric,
      alertType: row.alert_type,
      thresholdValue: row.threshold_value,
      thresholdOperator: row.threshold_operator,
      percentChangeValue: row.percent_change_value,
      percentChangePeriod: row.percent_change_period,
      percentChangeDirection: row.percent_change_direction,
      anomalySensitivity: row.anomaly_sensitivity,
      anomalyLookbackDays: row.anomaly_lookback_days,
      evaluationFrequency: row.evaluation_frequency,
      evaluationSchedule: row.evaluation_schedule,
      facilityId: row.facility_id,
      dateRangeStart: row.date_range_start,
      dateRangeEnd: row.date_range_end,
      channels: row.channels,
      enabled: row.enabled,
      lastEvaluatedAt: row.last_evaluated_at,
      lastTriggeredAt: row.last_triggered_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  }

  private mapNotificationFromDB(row: any): AlertNotification {
    return {
      id: row.id,
      alertId: row.alert_id,
      triggeredAt: row.triggered_at,
      metricValue: parseFloat(row.metric_value),
      thresholdBreached: row.threshold_breached,
      channelType: row.channel_type,
      channelConfig: row.channel_config,
      recipient: row.recipient,
      status: row.status,
      sentAt: row.sent_at,
      errorMessage: row.error_message,
      retryCount: row.retry_count,
      details: row.details,
    };
  }
}

export const alertsService = new AlertsService();

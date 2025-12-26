import { Pool } from 'pg';
import logger from '../utils/logger';

export interface DataQualityCheck {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
  value?: number;
  threshold?: number;
  timestamp: Date;
}

export interface DataQualityReport {
  checks: DataQualityCheck[];
  overallStatus: 'pass' | 'warn' | 'fail';
  timestamp: Date;
}

export class DataQualityMonitor {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async runAllChecks(): Promise<DataQualityReport> {
    const checks: DataQualityCheck[] = [];

    // Run all checks
    checks.push(await this.checkDataFreshness());
    checks.push(await this.checkNullRates());
    checks.push(await this.checkValueRanges());
    checks.push(await this.checkAnomalies());
    checks.push(await this.checkRelationshipIntegrity());

    // Determine overall status
    const overallStatus = checks.some(c => c.status === 'fail') 
      ? 'fail' 
      : checks.some(c => c.status === 'warn')
      ? 'warn'
      : 'pass';

    return {
      checks,
      overallStatus,
      timestamp: new Date(),
    };
  }

  private async checkDataFreshness(): Promise<DataQualityCheck> {
    try {
      const result = await this.pool.query(`
        SELECT 
          EXTRACT(EPOCH FROM (NOW() - MAX(updated_at))) / 3600 as hours_since_update
        FROM applications
      `);

      const hoursSinceUpdate = result.rows[0]?.hours_since_update || 0;
      const threshold = 24; // 24 hours

      return {
        name: 'Data Freshness',
        status: hoursSinceUpdate > threshold ? 'fail' : hoursSinceUpdate > threshold / 2 ? 'warn' : 'pass',
        message: `Last update was ${hoursSinceUpdate.toFixed(1)} hours ago`,
        value: hoursSinceUpdate,
        threshold,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Data freshness check failed', { error });
      return {
        name: 'Data Freshness',
        status: 'fail',
        message: `Check failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  private async checkNullRates(): Promise<DataQualityCheck> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_rows,
          COUNT(CASE WHEN facility_id IS NULL THEN 1 END) as null_facility_ids,
          COUNT(CASE WHEN status IS NULL THEN 1 END) as null_statuses
        FROM applications
        WHERE created_at >= NOW() - INTERVAL '30 days'
      `);

      const { total_rows, null_facility_ids, null_statuses } = result.rows[0];
      const nullRate = (parseInt(null_facility_ids) + parseInt(null_statuses)) / (parseInt(total_rows) * 2);
      const threshold = 0.01; // 1% null rate

      return {
        name: 'Null Rate Check',
        status: nullRate > threshold ? 'fail' : nullRate > threshold / 2 ? 'warn' : 'pass',
        message: `Null rate: ${(nullRate * 100).toFixed(2)}%`,
        value: nullRate,
        threshold,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Null rate check failed', { error });
      return {
        name: 'Null Rate Check',
        status: 'fail',
        message: `Check failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  private async checkValueRanges(): Promise<DataQualityCheck> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_rows,
          COUNT(CASE WHEN compliance_score < 0 OR compliance_score > 100 THEN 1 END) as invalid_scores,
          COUNT(CASE WHEN amount < 0 THEN 1 END) as negative_amounts
        FROM applications a
        LEFT JOIN invoices i ON a.id = i.application_id
        WHERE a.created_at >= NOW() - INTERVAL '30 days'
      `);

      const { total_rows, invalid_scores, negative_amounts } = result.rows[0];
      const invalidRate = (parseInt(invalid_scores) + parseInt(negative_amounts)) / parseInt(total_rows);
      const threshold = 0.001; // 0.1% invalid values

      return {
        name: 'Value Range Check',
        status: invalidRate > threshold ? 'fail' : invalidRate > threshold / 2 ? 'warn' : 'pass',
        message: `Invalid value rate: ${(invalidRate * 100).toFixed(3)}%`,
        value: invalidRate,
        threshold,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Value range check failed', { error });
      return {
        name: 'Value Range Check',
        status: 'fail',
        message: `Check failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  private async checkAnomalies(): Promise<DataQualityCheck> {
    try {
      const result = await this.pool.query(`
        WITH daily_stats AS (
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as daily_count
          FROM applications
          WHERE created_at >= NOW() - INTERVAL '90 days'
          GROUP BY DATE(created_at)
        ),
        stats AS (
          SELECT 
            AVG(daily_count) as avg_count,
            STDDEV(daily_count) as stddev_count
          FROM daily_stats
        ),
        recent AS (
          SELECT COUNT(*) as today_count
          FROM applications
          WHERE DATE(created_at) = CURRENT_DATE
        )
        SELECT 
          r.today_count,
          s.avg_count,
          s.stddev_count,
          CASE 
            WHEN s.stddev_count > 0 THEN ABS(r.today_count - s.avg_count) / s.stddev_count
            ELSE 0
          END as z_score
        FROM recent r, stats s
      `);

      const { today_count, avg_count, stddev_count, z_score } = result.rows[0];
      const threshold = 3; // 3 standard deviations

      return {
        name: 'Anomaly Detection',
        status: z_score > threshold ? 'warn' : 'pass',
        message: `Today's count: ${today_count}, Average: ${parseFloat(avg_count).toFixed(1)}, Z-score: ${parseFloat(z_score).toFixed(2)}`,
        value: parseFloat(z_score),
        threshold,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Anomaly detection check failed', { error });
      return {
        name: 'Anomaly Detection',
        status: 'fail',
        message: `Check failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }

  private async checkRelationshipIntegrity(): Promise<DataQualityCheck> {
    try {
      const result = await this.pool.query(`
        SELECT 
          COUNT(*) as total_applications,
          COUNT(CASE WHEN f.id IS NULL THEN 1 END) as orphaned_facilities
        FROM applications a
        LEFT JOIN facilities f ON a.facility_id = f.id
        WHERE a.created_at >= NOW() - INTERVAL '30 days'
      `);

      const { total_applications, orphaned_facilities } = result.rows[0];
      const orphanRate = parseInt(orphaned_facilities) / parseInt(total_applications);
      const threshold = 0.001; // 0.1% orphaned records

      return {
        name: 'Relationship Integrity',
        status: orphanRate > threshold ? 'fail' : orphanRate > threshold / 2 ? 'warn' : 'pass',
        message: `Orphaned record rate: ${(orphanRate * 100).toFixed(3)}%`,
        value: orphanRate,
        threshold,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('Relationship integrity check failed', { error });
      return {
        name: 'Relationship Integrity',
        status: 'fail',
        message: `Check failed: ${error}`,
        timestamp: new Date(),
      };
    }
  }
}

export async function sendDataQualityAlert(report: DataQualityReport, config: { slackWebhook?: string; emailRecipients?: string[] }): Promise<void> {
  if (report.overallStatus === 'pass') {
    return;
  }

  const failedChecks = report.checks.filter(c => c.status === 'fail');
  const warnChecks = report.checks.filter(c => c.status === 'warn');

  const message = `
Data Quality Alert - Status: ${report.overallStatus.toUpperCase()}

Failed Checks (${failedChecks.length}):
${failedChecks.map(c => `- ${c.name}: ${c.message}`).join('\n')}

Warning Checks (${warnChecks.length}):
${warnChecks.map(c => `- ${c.name}: ${c.message}`).join('\n')}

Timestamp: ${report.timestamp.toISOString()}
  `.trim();

  // Send to Slack if webhook is configured
  if (config.slackWebhook) {
    try {
      const response = await fetch(config.slackWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: message,
          username: 'Data Quality Monitor',
          icon_emoji: report.overallStatus === 'fail' ? ':x:' : ':warning:',
        }),
      });

      if (!response.ok) {
        logger.error('Failed to send Slack alert', { status: response.status });
      }
    } catch (error) {
      logger.error('Error sending Slack alert', { error });
    }
  }

  // Log alert (in production, this would send email)
  logger.warn('Data Quality Alert', { report, message });
}

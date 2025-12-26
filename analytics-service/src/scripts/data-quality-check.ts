#!/usr/bin/env node

/**
 * Data Quality Check CLI
 * Runs data quality monitoring and optionally sends alerts
 */

import { Pool } from 'pg';
import { DataQualityMonitor, sendDataQualityAlert } from '../services/data-quality-monitor';
import logger from '../utils/logger';

async function runDataQualityCheck() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    logger.info('Starting data quality check...');
    
    const monitor = new DataQualityMonitor(pool);
    const report = await monitor.runAllChecks();

    // Log summary
    logger.info('Data Quality Check Complete', {
      overall_status: report.overallStatus,
      timestamp: report.timestamp,
    });

    // Print report to console
    console.log('\n='.repeat(80));
    console.log('DATA QUALITY REPORT');
    console.log('='.repeat(80));
    console.log(`Timestamp: ${report.timestamp.toISOString()}`);
    console.log(`Overall Status: ${report.overallStatus.toUpperCase()}`);
    console.log('');

    for (const check of report.checks) {
      const statusSymbol = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
      console.log(`${statusSymbol} ${check.name}: ${check.status.toUpperCase()}`);
      console.log(`  ${check.message}`);
    }

    console.log('='.repeat(80));
    console.log('');

    // Send alerts if configured
    if (process.env.SLACK_WEBHOOK_URL || process.env.EMAIL_RECIPIENTS) {
      await sendDataQualityAlert(report, {
        slackWebhook: process.env.SLACK_WEBHOOK_URL,
        emailRecipients: process.env.EMAIL_RECIPIENTS?.split(','),
      });
    }

    // Exit with appropriate code
    if (report.overallStatus === 'fail') {
      logger.error('Data quality check failed');
      process.exit(1);
    } else if (report.overallStatus === 'warn') {
      logger.warn('Data quality check completed with warnings');
      process.exit(0); // Don't fail on warnings
    } else {
      logger.info('Data quality check passed');
      process.exit(0);
    }
  } catch (error) {
    logger.error('Data quality check error', { error });
    console.error('Error running data quality check:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  runDataQualityCheck();
}

export { runDataQualityCheck };

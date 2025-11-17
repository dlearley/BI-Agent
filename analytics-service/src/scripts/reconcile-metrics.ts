#!/usr/bin/env node

/**
 * Reconciliation Script
 * Compares KPI metrics between analytics DB and source CRM transactional DB
 * Reports variances and generates a reconciliation report
 */

import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

interface ReconciliationResult {
  metric: string;
  source_value: number;
  analytics_value: number;
  variance: number;
  variance_percent: number;
  status: 'pass' | 'fail';
  threshold: number;
}

interface ReconciliationReport {
  timestamp: Date;
  results: ReconciliationResult[];
  overall_status: 'pass' | 'fail';
  pass_count: number;
  fail_count: number;
}

const VARIANCE_THRESHOLD = 0.01; // 1% variance threshold

async function reconcileMetrics(): Promise<ReconciliationReport> {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const results: ReconciliationResult[] = [];

    // Reconcile total applications
    const appsResult = await reconcileTotalApplications(pool);
    results.push(appsResult);

    // Reconcile hired count
    const hiredResult = await reconcileHiredCount(pool);
    results.push(hiredResult);

    // Reconcile total revenue
    const revenueResult = await reconcileTotalRevenue(pool);
    results.push(revenueResult);

    // Reconcile paid invoices count
    const invoicesResult = await reconcilePaidInvoices(pool);
    results.push(invoicesResult);

    // Reconcile compliance rate
    const complianceResult = await reconcileComplianceRate(pool);
    results.push(complianceResult);

    // Reconcile outreach count
    const outreachResult = await reconcileTotalOutreach(pool);
    results.push(outreachResult);

    const pass_count = results.filter(r => r.status === 'pass').length;
    const fail_count = results.filter(r => r.status === 'fail').length;

    return {
      timestamp: new Date(),
      results,
      overall_status: fail_count === 0 ? 'pass' : 'fail',
      pass_count,
      fail_count,
    };
  } finally {
    await pool.end();
  }
}

async function reconcileTotalApplications(pool: Pool): Promise<ReconciliationResult> {
  // Source: Count from raw applications table
  const sourceQuery = `
    SELECT COUNT(*) as count
    FROM applications
    WHERE created_at >= date_trunc('month', current_date - interval '12 months')
  `;
  const sourceResult = await pool.query(sourceQuery);
  const source_value = parseInt(sourceResult.rows[0].count);

  // Analytics: Sum from pipeline_kpis
  const analyticsQuery = `
    SELECT COALESCE(SUM(total_applications), 0) as count
    FROM analytics.pipeline_kpis
    WHERE month >= date_trunc('month', current_date - interval '12 months')
  `;
  const analyticsResult = await pool.query(analyticsQuery);
  const analytics_value = parseInt(analyticsResult.rows[0].count);

  return calculateVariance('Total Applications', source_value, analytics_value);
}

async function reconcileHiredCount(pool: Pool): Promise<ReconciliationResult> {
  // Source: Count from raw applications table
  const sourceQuery = `
    SELECT COUNT(*) as count
    FROM applications
    WHERE status = 'hired'
      AND created_at >= date_trunc('month', current_date - interval '12 months')
  `;
  const sourceResult = await pool.query(sourceQuery);
  const source_value = parseInt(sourceResult.rows[0].count);

  // Analytics: Sum from pipeline_kpis
  const analyticsQuery = `
    SELECT COALESCE(SUM(hired_count), 0) as count
    FROM analytics.pipeline_kpis
    WHERE month >= date_trunc('month', current_date - interval '12 months')
  `;
  const analyticsResult = await pool.query(analyticsQuery);
  const analytics_value = parseInt(analyticsResult.rows[0].count);

  return calculateVariance('Hired Count', source_value, analytics_value);
}

async function reconcileTotalRevenue(pool: Pool): Promise<ReconciliationResult> {
  // Source: Sum from raw invoices table
  const sourceQuery = `
    SELECT COALESCE(SUM(amount), 0) as total
    FROM invoices
    WHERE status = 'paid'
      AND created_at >= date_trunc('month', current_date - interval '12 months')
  `;
  const sourceResult = await pool.query(sourceQuery);
  const source_value = parseFloat(sourceResult.rows[0].total);

  // Analytics: Sum from revenue_kpis
  const analyticsQuery = `
    SELECT COALESCE(SUM(total_revenue), 0) as total
    FROM analytics.revenue_kpis
    WHERE month >= date_trunc('month', current_date - interval '12 months')
  `;
  const analyticsResult = await pool.query(analyticsQuery);
  const analytics_value = parseFloat(analyticsResult.rows[0].total);

  return calculateVariance('Total Revenue', source_value, analytics_value);
}

async function reconcilePaidInvoices(pool: Pool): Promise<ReconciliationResult> {
  // Source: Count from raw invoices table
  const sourceQuery = `
    SELECT COUNT(*) as count
    FROM invoices
    WHERE status = 'paid'
      AND created_at >= date_trunc('month', current_date - interval '12 months')
  `;
  const sourceResult = await pool.query(sourceQuery);
  const source_value = parseInt(sourceResult.rows[0].count);

  // Analytics: Sum from revenue_kpis
  const analyticsQuery = `
    SELECT COALESCE(SUM(total_invoices), 0) as count
    FROM analytics.revenue_kpis
    WHERE month >= date_trunc('month', current_date - interval '12 months')
  `;
  const analyticsResult = await pool.query(analyticsQuery);
  const analytics_value = parseInt(analyticsResult.rows[0].count);

  return calculateVariance('Paid Invoices Count', source_value, analytics_value);
}

async function reconcileComplianceRate(pool: Pool): Promise<ReconciliationResult> {
  // Source: Calculate from raw applications table
  const sourceQuery = `
    SELECT 
      COUNT(*) as total,
      COUNT(CASE WHEN has_violations = false AND compliance_score >= 70 THEN 1 END) as compliant
    FROM applications
    WHERE created_at >= date_trunc('month', current_date - interval '12 months')
  `;
  const sourceResult = await pool.query(sourceQuery);
  const source_value = sourceResult.rows[0].total > 0 
    ? parseFloat(sourceResult.rows[0].compliant) / parseFloat(sourceResult.rows[0].total)
    : 0;

  // Analytics: Average from compliance_kpis
  const analyticsQuery = `
    SELECT COALESCE(AVG(compliance_rate), 0) as rate
    FROM analytics.compliance_kpis
    WHERE month >= date_trunc('month', current_date - interval '12 months')
  `;
  const analyticsResult = await pool.query(analyticsQuery);
  const analytics_value = parseFloat(analyticsResult.rows[0].rate);

  return calculateVariance('Compliance Rate', source_value, analytics_value);
}

async function reconcileTotalOutreach(pool: Pool): Promise<ReconciliationResult> {
  // Source: Count from raw outreach table
  const sourceQuery = `
    SELECT COUNT(*) as count
    FROM outreach
    WHERE sent_at >= date_trunc('month', current_date - interval '12 months')
  `;
  const sourceResult = await pool.query(sourceQuery);
  const source_value = parseInt(sourceResult.rows[0].count);

  // Analytics: Sum from outreach_kpis
  const analyticsQuery = `
    SELECT COALESCE(SUM(total_outreach), 0) as count
    FROM analytics.outreach_kpis
    WHERE month >= date_trunc('month', current_date - interval '12 months')
  `;
  const analyticsResult = await pool.query(analyticsQuery);
  const analytics_value = parseInt(analyticsResult.rows[0].count);

  return calculateVariance('Total Outreach', source_value, analytics_value);
}

function calculateVariance(
  metric: string,
  source_value: number,
  analytics_value: number
): ReconciliationResult {
  const variance = analytics_value - source_value;
  const variance_percent = source_value !== 0 ? Math.abs(variance) / source_value : 0;
  const status = variance_percent <= VARIANCE_THRESHOLD ? 'pass' : 'fail';

  return {
    metric,
    source_value,
    analytics_value,
    variance,
    variance_percent,
    status,
    threshold: VARIANCE_THRESHOLD,
  };
}

function generateReport(report: ReconciliationReport): string {
  const lines: string[] = [];
  
  lines.push('='.repeat(80));
  lines.push('ANALYTICS RECONCILIATION REPORT');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Timestamp: ${report.timestamp.toISOString()}`);
  lines.push(`Overall Status: ${report.overall_status.toUpperCase()}`);
  lines.push(`Pass: ${report.pass_count} | Fail: ${report.fail_count}`);
  lines.push('');
  lines.push('-'.repeat(80));
  lines.push(
    'Metric'.padEnd(30) +
    'Source'.padEnd(15) +
    'Analytics'.padEnd(15) +
    'Variance'.padEnd(12) +
    'Status'
  );
  lines.push('-'.repeat(80));

  for (const result of report.results) {
    const variance_display = `${(result.variance_percent * 100).toFixed(2)}%`;
    const status_symbol = result.status === 'pass' ? '✓' : '✗';
    
    lines.push(
      result.metric.padEnd(30) +
      result.source_value.toFixed(2).padEnd(15) +
      result.analytics_value.toFixed(2).padEnd(15) +
      variance_display.padEnd(12) +
      `${status_symbol} ${result.status.toUpperCase()}`
    );
  }

  lines.push('-'.repeat(80));
  lines.push('');

  if (report.fail_count > 0) {
    lines.push('FAILED METRICS:');
    for (const result of report.results.filter(r => r.status === 'fail')) {
      lines.push(`  - ${result.metric}: ${(result.variance_percent * 100).toFixed(2)}% variance (threshold: ${(result.threshold * 100).toFixed(0)}%)`);
    }
    lines.push('');
  }

  lines.push('Variance Threshold: ' + (VARIANCE_THRESHOLD * 100).toFixed(2) + '%');
  lines.push('='.repeat(80));
  
  return lines.join('\n');
}

// Main execution
if (require.main === module) {
  (async () => {
    try {
      console.log('Starting reconciliation...\n');
      
      const report = await reconcileMetrics();
      const reportText = generateReport(report);
      
      console.log(reportText);
      
      // Save report to file
      const reportDir = path.join(__dirname, '../../reports');
      if (!fs.existsSync(reportDir)) {
        fs.mkdirSync(reportDir, { recursive: true });
      }
      
      const reportFile = path.join(
        reportDir,
        `reconciliation_${new Date().toISOString().replace(/:/g, '-')}.txt`
      );
      fs.writeFileSync(reportFile, reportText);
      console.log(`\nReport saved to: ${reportFile}`);
      
      // Save JSON report
      const jsonFile = path.join(
        reportDir,
        `reconciliation_${new Date().toISOString().replace(/:/g, '-')}.json`
      );
      fs.writeFileSync(jsonFile, JSON.stringify(report, null, 2));
      console.log(`JSON report saved to: ${jsonFile}`);
      
      // Exit with appropriate code
      process.exit(report.overall_status === 'pass' ? 0 : 1);
    } catch (error) {
      console.error('Reconciliation failed:', error);
      process.exit(1);
    }
  })();
}

export { reconcileMetrics, generateReport };

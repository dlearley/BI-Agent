# Data Quality and Validation

This document describes the comprehensive data quality validation, reconciliation, and load testing infrastructure for the Analytics service.

## Table of Contents

- [Overview](#overview)
- [DBT Tests](#dbt-tests)
- [Data Quality Monitoring](#data-quality-monitoring)
- [Reconciliation](#reconciliation)
- [Load Testing](#load-testing)
- [CI/CD Integration](#cicd-integration)
- [Alerting](#alerting)

## Overview

The analytics platform includes comprehensive validation across three key areas:

1. **DBT Tests**: Schema validation, relationship integrity, and data freshness checks
2. **Data Quality Monitoring**: Automated monitoring for anomalies, null rates, and value ranges
3. **Reconciliation**: Comparison of analytics metrics against source transactional data
4. **Load Testing**: Performance validation under expected concurrency

## DBT Tests

### Schema Tests

Each dbt model includes comprehensive schema tests defined in `schema.yml` files:

#### Intermediate Models (`dbt/models/intermediate/schema.yml`)

- **Unique and not-null constraints** on primary keys
- **Relationship tests** to validate foreign key integrity
- **Accepted values** for categorical columns
- **Range validations** for numeric fields (using dbt-utils)
- **Freshness checks** to ensure data is updated within 7 days

Example:
```yaml
models:
  - name: stg_applications
    columns:
      - name: application_id
        tests:
          - unique
          - not_null
      - name: facility_id
        tests:
          - not_null
          - relationships:
              to: source('raw', 'facilities')
              field: id
```

#### KPI Models (`dbt/models/kpis/schema.yml`)

- **Unique combination tests** to prevent duplicate aggregations
- **Range validations** for metrics (e.g., compliance_rate between 0-1)
- **Relationship tests** to ensure valid facility references
- **Value validations** for counts and aggregations

### Source Freshness

Data freshness is monitored at the source level (`dbt/macros/source_definitions.yml`):

```yaml
sources:
  - name: raw
    freshness:
      warn_after: {count: 24, period: hour}
      error_after: {count: 48, period: hour}
    tables:
      - name: applications
        freshness:
          warn_after: {count: 12, period: hour}
          error_after: {count: 24, period: hour}
```

### Custom Tests

Custom data quality tests for anomaly detection are in `dbt/tests/data_quality_checks.sql`:

- Statistical anomaly detection using 3-sigma rule
- Monthly application count variance detection
- Automatic flagging of unusual patterns

### Running DBT Tests

```bash
# Install dbt packages (includes dbt-utils)
cd dbt
dbt deps

# Run all models
dbt run

# Run all tests
dbt test

# Check source freshness
dbt source freshness

# Run specific test
dbt test --select stg_applications
```

## Data Quality Monitoring

### Automated Checks

The `DataQualityMonitor` service (`analytics-service/src/services/data-quality-monitor.ts`) performs automated checks:

1. **Data Freshness**: Ensures data is updated within threshold (24 hours)
2. **Null Rate Check**: Validates null rates are below 1%
3. **Value Range Check**: Ensures values are within expected ranges
4. **Anomaly Detection**: Uses statistical methods (z-score) to detect unusual patterns
5. **Relationship Integrity**: Validates foreign key relationships

### Running Data Quality Checks

```bash
# Run data quality monitor
npm run dq:monitor

# With custom environment
DATABASE_URL=postgresql://... npm run dq:monitor
```

### Output

The monitor generates a comprehensive report:

```
Data Quality Report
===================
✓ Data Freshness: PASS (12.5 hours since last update)
✓ Null Rate Check: PASS (0.05% null rate)
✓ Value Range Check: PASS (0.001% invalid values)
⚠ Anomaly Detection: WARN (Z-score: 2.8)
✓ Relationship Integrity: PASS (0.0% orphaned records)

Overall Status: WARN
```

## Reconciliation

### Metrics Reconciliation

The reconciliation script (`analytics-service/src/scripts/reconcile-metrics.ts`) compares analytics KPIs against source transactional data:

**Key Metrics Reconciled:**
- Total Applications
- Hired Count
- Total Revenue
- Paid Invoices Count
- Compliance Rate
- Total Outreach

### Variance Threshold

- **Target**: < 1% variance for all key metrics
- **Status**: Pass/Fail per metric
- **Reporting**: Text and JSON formats

### Running Reconciliation

```bash
# Run reconciliation
npm run analytics:reconcile

# With custom environment
DATABASE_URL=postgresql://... npm run analytics:reconcile
```

### Reconciliation Report

Example output:

```
================================================================================
ANALYTICS RECONCILIATION REPORT
================================================================================

Timestamp: 2024-01-15T10:30:00.000Z
Overall Status: PASS
Pass: 6 | Fail: 0

--------------------------------------------------------------------------------
Metric                        Source         Analytics      Variance    Status
--------------------------------------------------------------------------------
Total Applications            1250           1248           0.16%       ✓ PASS
Hired Count                   185            185            0.00%       ✓ PASS
Total Revenue                 125000.50      124998.25      0.00%       ✓ PASS
Paid Invoices Count           340            340            0.00%       ✓ PASS
Compliance Rate               0.89           0.89           0.00%       ✓ PASS
Total Outreach                5420           5418           0.04%       ✓ PASS
--------------------------------------------------------------------------------

Variance Threshold: 1.00%
================================================================================
```

### Output Files

Reports are saved to `analytics-service/reports/`:
- `reconciliation_[timestamp].txt` - Human-readable report
- `reconciliation_[timestamp].json` - Machine-readable data

## Load Testing

### Infrastructure

Load testing uses autocannon for Node.js-based performance testing:

**Test Configuration:**
- Duration: 60 seconds (configurable)
- Connections: 50 concurrent (configurable)
- Endpoints tested: Health, KPIs (all variants)

### Latency Targets

- **P50**: < 100ms
- **P95**: < 500ms
- **P99**: < 1000ms
- **Error Rate**: < 1%

### Running Load Tests

```bash
# Run standard load test (60s, 50 connections)
npm run loadtest

# Run short test (30s, 25 connections)
npm run loadtest:short

# Run long test (120s, 100 connections)
npm run loadtest:long

# Custom configuration
DURATION=90 CONNECTIONS=75 npm run loadtest
```

### Load Test Report

Example output:

```
================================================================================
LOAD TEST SUMMARY REPORT
================================================================================

Timestamp: 2024-01-15T10:45:00.000Z
Test Configuration: 50 connections, 60s duration

--------------------------------------------------------------------------------
Endpoint                           Req/s      P50(ms)    P95(ms)    P99(ms)    Errors     Status
--------------------------------------------------------------------------------
GET /health                        245.32     45.20      89.50      120.30     0          PASS
GET /api/v1/kpis                  198.45     78.40      385.20     890.50     0          PASS
GET /api/v1/kpis/pipeline         205.12     65.30      320.40     780.20     0          PASS
GET /api/v1/kpis/revenue          210.34     62.10      298.50     720.30     0          PASS
GET /api/v1/kpis/compliance       208.87     68.20      310.40     750.10     0          PASS
GET /api/v1/kpis/outreach         203.56     70.50      325.60     790.40     0          PASS
--------------------------------------------------------------------------------

LATENCY TARGETS:
  P50: 100ms | P95: 500ms | P99: 1000ms

OVERALL: 6/6 endpoints passed latency targets

================================================================================
```

### Output Files

Load test results are saved to `analytics-service/reports/`:
- `load-test_[timestamp].txt` - Human-readable report
- `load-test_[timestamp].json` - Machine-readable metrics

## CI/CD Integration

### DBT Data Quality Workflow

**File**: `.github/workflows/dbt-data-quality.yml`

Runs on:
- Push to main/develop
- Pull requests
- Daily schedule (6 AM UTC)
- Manual trigger

**Steps:**
1. Setup PostgreSQL and seed test data
2. Install dbt and dependencies
3. Run dbt models
4. Execute dbt tests
5. Check source freshness
6. Run data quality monitors
7. Execute reconciliation
8. Generate and upload reports
9. Validate reconciliation results (< 1% variance)

### Load Test Workflow

**File**: `.github/workflows/load-test.yml`

Runs on:
- Push to main/develop
- Pull requests
- Manual trigger (with configurable params)

**Steps:**
1. Setup PostgreSQL, Redis, and seed data
2. Start analytics API
3. Run load tests
4. Validate latency targets
5. Upload results and reports

### Alerting Configuration

Alerts are triggered when:
- DBT tests fail
- Source freshness warnings/errors
- Data quality checks fail
- Reconciliation variance > 1%
- Load test targets not met

## Alerting

### Data Quality Alerts

The `sendDataQualityAlert` function supports:

**Slack Integration:**
```typescript
await sendDataQualityAlert(report, {
  slackWebhook: process.env.SLACK_WEBHOOK_URL,
});
```

**Email Integration:**
```typescript
await sendDataQualityAlert(report, {
  emailRecipients: ['ops@example.com', 'analytics@example.com'],
});
```

### Configuration

Set environment variables:

```bash
# Slack webhook for alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...

# Email recipients (comma-separated)
EMAIL_RECIPIENTS=ops@example.com,analytics@example.com

# Alert thresholds
DATA_FRESHNESS_THRESHOLD_HOURS=24
NULL_RATE_THRESHOLD=0.01
ANOMALY_Z_SCORE_THRESHOLD=3
```

### Alert Message Format

```
Data Quality Alert - Status: FAIL

Failed Checks (2):
- Data Freshness: Last update was 36.5 hours ago
- Anomaly Detection: Z-score: 4.2 (threshold: 3.0)

Warning Checks (1):
- Null Rate Check: Null rate: 0.8%

Timestamp: 2024-01-15T10:30:00.000Z
```

## Best Practices

### DBT Tests

1. **Run tests before deploying**: Always run `dbt test` before promoting models
2. **Monitor test failures**: Set up alerts for test failures in CI
3. **Document test rationale**: Add descriptions to custom tests
4. **Use appropriate severity**: Set severity levels (warn/error) based on impact

### Data Quality

1. **Schedule regular checks**: Run data quality monitors hourly/daily
2. **Set realistic thresholds**: Base thresholds on historical data patterns
3. **Investigate warnings**: Don't ignore warnings - they indicate potential issues
4. **Document anomalies**: Keep a log of known anomalies and their causes

### Reconciliation

1. **Run after ETL**: Execute reconciliation after each analytics refresh
2. **Track trends**: Monitor variance trends over time
3. **Set up alerts**: Alert on reconciliation failures
4. **Investigate failures**: Always investigate failures > 1% variance

### Load Testing

1. **Test before release**: Run load tests on staging before production
2. **Baseline performance**: Establish baseline metrics for comparison
3. **Test realistic scenarios**: Use realistic data volumes and access patterns
4. **Monitor degradation**: Watch for performance degradation over time

## Troubleshooting

### DBT Test Failures

```bash
# Run specific test with verbose output
dbt test --select stg_applications --debug

# Check compiled SQL
cat dbt/target/compiled/analytics/models/...
```

### Data Quality Issues

```bash
# Check database directly
psql $DATABASE_URL -c "SELECT COUNT(*) FROM applications WHERE updated_at < NOW() - INTERVAL '24 hours'"

# Review monitor logs
tail -f logs/data-quality-monitor.log
```

### Reconciliation Discrepancies

```bash
# Check source data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM applications WHERE status = 'hired'"

# Check analytics data
psql $DATABASE_URL -c "SELECT SUM(hired_count) FROM analytics.pipeline_kpis"
```

### Load Test Failures

```bash
# Check server logs
tail -f server.log

# Test single endpoint
curl -w "@curl-format.txt" http://localhost:3000/api/v1/kpis

# Reduce load
CONNECTIONS=10 DURATION=30 npm run loadtest
```

## Maintenance

### Regular Tasks

- **Weekly**: Review reconciliation reports for trends
- **Monthly**: Update variance thresholds based on data patterns
- **Quarterly**: Review and update load test scenarios
- **As needed**: Add new tests for new data sources/models

### Updating Tests

When adding new models or columns:

1. Add schema tests in appropriate `schema.yml`
2. Update reconciliation script if new KPIs added
3. Add data quality checks if needed
4. Update load test to include new endpoints
5. Document changes in this file

## Support

For issues or questions:
1. Check CI logs for detailed error messages
2. Review relevant documentation sections
3. Check database directly to validate data
4. Consult team lead or data engineering team

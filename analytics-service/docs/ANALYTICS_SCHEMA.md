# Analytics Schema Documentation

This document describes the analytics schema, KPI calculations, and data relationships for the healthcare recruitment analytics system.

## Overview

The analytics system provides comprehensive insights into:
- **Pipeline Metrics**: Application flow and conversion rates
- **Compliance Metrics**: Regulatory compliance tracking
- **Revenue Metrics**: Financial performance analysis
- **Outreach Metrics**: Recruitment channel effectiveness

## Database Schema

### Core Tables

#### `facilities`
Stores healthcare facility information.

| Column | Type | Description |
|--------|------|-------------|
| `id` | VARCHAR(50) | Primary key, facility identifier |
| `name` | VARCHAR(255) | Facility name |
| `type` | VARCHAR(100) | Facility type (Hospital, Clinic, etc.) |
| `location` | VARCHAR(255) | Facility location |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

#### `applications`
Tracks candidate applications through the recruitment pipeline.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `facility_id` | VARCHAR(50) | Foreign key to facilities |
| `candidate_id` | UUID | Candidate identifier |
| `status` | VARCHAR(50) | Application status (pending, interview, hired, rejected) |
| `created_at` | TIMESTAMP | Application creation date |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `hired_at` | TIMESTAMP | Date when candidate was hired |
| `compliance_score` | INTEGER(0-100) | Compliance score (0-100) |
| `has_violations` | BOOLEAN | Indicates compliance violations |

#### `invoices`
Financial records for recruitment services.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `facility_id` | VARCHAR(50) | Foreign key to facilities |
| `application_id` | UUID | Foreign key to applications |
| `amount` | DECIMAL(10,2) | Invoice amount |
| `status` | VARCHAR(50) | Invoice status (pending, paid, cancelled) |
| `created_at` | TIMESTAMP | Invoice creation date |
| `updated_at` | TIMESTAMP | Last update timestamp |
| `paid_at` | TIMESTAMP | Payment date |

#### `outreach`
Recruitment outreach activities and responses.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `facility_id` | VARCHAR(50) | Foreign key to facilities |
| `candidate_id` | UUID | Candidate identifier |
| `channel` | VARCHAR(100) | Outreach channel (email, phone, social, etc.) |
| `message` | TEXT | Outreach message content |
| `sent_at` | TIMESTAMP | When outreach was sent |
| `response_received` | BOOLEAN | Whether response was received |
| `responded_at` | TIMESTAMP | Response timestamp |
| `converted` | BOOLEAN | Whether outreach led to conversion |
| `created_at` | TIMESTAMP | Record creation timestamp |
| `updated_at` | TIMESTAMP | Last update timestamp |

## Analytics Views

### Materialized Views

Materialized views are pre-computed and refreshed periodically for performance.

#### `analytics.pipeline_kpis_materialized`
Pipeline metrics by facility and month.

| Column | Type | Description |
|--------|------|-------------|
| `facility_id` | VARCHAR(50) | Facility identifier |
| `month` | TIMESTAMP | Monthly aggregation period |
| `total_applications` | INTEGER | Total applications in period |
| `hired_count` | INTEGER | Number of hired candidates |
| `rejected_count` | INTEGER | Number of rejected applications |
| `pending_count` | INTEGER | Number of pending applications |
| `interview_count` | INTEGER | Number of applications in interview |
| `avg_time_to_fill_days` | DECIMAL | Average days to fill position |
| `last_updated` | TIMESTAMP | Last refresh timestamp |

#### `analytics.compliance_kpis_materialized`
Compliance metrics by facility and month.

| Column | Type | Description |
|--------|------|-------------|
| `facility_id` | VARCHAR(50) | Facility identifier |
| `month` | TIMESTAMP | Monthly aggregation period |
| `total_applications` | INTEGER | Total applications |
| `compliant_applications` | INTEGER | Applications meeting compliance standards |
| `avg_compliance_score` | DECIMAL | Average compliance score |
| `violation_count` | INTEGER | Number of compliance violations |
| `last_updated` | TIMESTAMP | Last refresh timestamp |

#### `analytics.revenue_kpis_materialized`
Revenue metrics by facility and month.

| Column | Type | Description |
|--------|------|-------------|
| `facility_id` | VARCHAR(50) | Facility identifier |
| `month` | TIMESTAMP | Monthly aggregation period |
| `total_invoices` | INTEGER | Number of invoices |
| `total_revenue` | DECIMAL | Total revenue amount |
| `avg_revenue_per_invoice` | DECIMAL | Average revenue per invoice |
| `last_updated` | TIMESTAMP | Last refresh timestamp |

#### `analytics.outreach_kpis_materialized`
Outreach effectiveness by facility, channel, and month.

| Column | Type | Description |
|--------|------|-------------|
| `facility_id` | VARCHAR(50) | Facility identifier |
| `channel` | VARCHAR(100) | Outreach channel |
| `month` | TIMESTAMP | Monthly aggregation period |
| `total_outreach` | INTEGER | Total outreach attempts |
| `responses` | INTEGER | Number of responses received |
| `conversions` | INTEGER | Number of successful conversions |
| `response_rate` | DECIMAL | Response rate percentage |
| `conversion_rate` | DECIMAL | Conversion rate percentage |
| `last_updated` | TIMESTAMP | Last refresh timestamp |

### Standard Views

Standard views provide real-time access to data.

#### `analytics.combined_kpis`
Unified view combining all KPI metrics.

Joins all materialized views to provide a comprehensive analytics dashboard.

## KPI Calculations

### Pipeline Metrics

#### Time-to-Fill
```sql
AVG(
  CASE 
    WHEN status = 'hired' AND hired_at IS NOT NULL 
    THEN EXTRACT(EPOCH FROM (hired_at - created_at)) / 86400 
  END
)
```
Calculates average days from application creation to hire date.

#### Conversion Rates
```sql
-- Hire Rate
hired_count / total_applications * 100

-- Interview Rate
interview_count / total_applications * 100

-- Rejection Rate
rejected_count / total_applications * 100
```

### Compliance Metrics

#### Compliance Rate
```sql
(compliant_applications / total_applications) * 100
```
Percentage of applications meeting compliance standards.

#### Average Compliance Score
```sql
AVG(compliance_score)
```
Average compliance score across all applications.

### Revenue Metrics

#### Average Revenue Per Placement
```sql
SUM(total_revenue) / SUM(total_invoices)
```
Average revenue generated per successful placement.

#### Revenue Growth
```sql
(current_period_revenue - previous_period_revenue) / previous_period_revenue * 100
```
Month-over-month revenue growth percentage.

### Outreach Metrics

#### Response Rate
```sql
(responses / total_outreach) * 100
```
Percentage of outreach attempts that received responses.

#### Conversion Rate
```sql
(conversions / total_outreach) * 100
```
Percentage of outreach attempts that led to successful conversions.

#### Channel Effectiveness
```sql
-- Most effective channel by response rate
SELECT channel, AVG(response_rate) as avg_response_rate
FROM analytics.outreach_kpis_materialized
GROUP BY channel
ORDER BY avg_response_rate DESC

-- Most effective channel by conversion rate
SELECT channel, AVG(conversion_rate) as avg_conversion_rate
FROM analytics.outreach_kpis_materialized
GROUP BY channel
ORDER BY avg_conversion_rate DESC
```

## Refresh Strategy

### Automatic Refresh

Materialized views are refreshed automatically:

1. **Full Refresh**: Every hour (all views)
2. **Pipeline Refresh**: Every 30 minutes (critical metrics)
3. **Event-Driven**: On significant data changes

### Manual Refresh

#### Using API
```bash
# Refresh all views
curl -X POST http://localhost:3000/api/v1/analytics/refresh \
  -H "Authorization: Bearer <token>"

# Refresh specific view
curl -X POST http://localhost:3000/api/v1/analytics/refresh \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"viewName": "pipeline"}'
```

#### Using CLI
```bash
# Refresh all views
pnpm analytics:refresh refresh

# Refresh specific view
pnpm analytics:refresh refresh pipeline

# Schedule delayed refresh
pnpm analytics:refresh schedule pipeline 5000
```

#### Using SQL
```sql
-- Refresh all views
SELECT analytics.refresh_all_analytics();

-- Refresh specific view
SELECT analytics.refresh_pipeline_kpis();
```

## Performance Optimization

### Indexes

Critical indexes for performance:

```sql
-- Time-based queries
CREATE INDEX idx_applications_created_at ON applications(created_at);
CREATE INDEX idx_invoices_created_at ON invoices(created_at);
CREATE INDEX idx_outreach_created_at ON outreach(created_at);

-- Facility-based filtering
CREATE INDEX idx_applications_facility_id ON applications(facility_id);
CREATE INDEX idx_invoices_facility_id ON invoices(facility_id);
CREATE INDEX idx_outreach_facility_id ON outreach(facility_id);

-- Status-based queries
CREATE INDEX idx_applications_status ON applications(status);
CREATE INDEX idx_invoices_status ON invoices(status);

-- Materialized view refresh optimization
CREATE UNIQUE INDEX idx_pipeline_kpis_materialized_unique 
ON analytics.pipeline_kpis_materialized (facility_id, month);
```

### Query Optimization

1. **Use materialized views** for aggregations
2. **Filter by date ranges** to limit data volume
3. **Leverage facility indexes** for RBAC filtering
4. **Cache frequent queries** using Redis
5. **Use concurrent refresh** to avoid locking

## Data Quality

### Validation Rules

#### Applications
- `created_at` must be valid timestamp
- `status` must be valid enum value
- `compliance_score` must be 0-100
- `hired_at` must be after `created_at` if present

#### Invoices
- `amount` must be positive
- `status` must be valid enum value
- `paid_at` must be after `created_at` if present

#### Outreach
- `channel` must be valid enum value
- `responded_at` must be after `sent_at` if present

### Monitoring

#### Data Freshness
```sql
-- Check last refresh times
SELECT * FROM analytics.get_last_refresh();

-- Monitor data lag
SELECT 
  view_name,
  last_updated,
  NOW() - last_updated as data_lag
FROM analytics.get_last_refresh();
```

#### Row Count Monitoring
```sql
-- Monitor data volumes
SELECT 
  'applications' as table_name, COUNT(*) as row_count, MAX(created_at) as latest_date
FROM applications
UNION ALL
SELECT 
  'invoices' as table_name, COUNT(*) as row_count, MAX(created_at) as latest_date
FROM invoices
UNION ALL
SELECT 
  'outreach' as table_name, COUNT(*) as row_count, MAX(created_at) as latest_date
FROM outreach;
```

## HIPAA Compliance

### PII Fields

The following fields are considered PII and are automatically redacted:

- Personal identifiers: `name`, `email`, `phone`, `ssn`, `dob`
- Medical information: Any medical-related fields
- Identifiers: `id`, `userId`, `applicantId`, `patientId`

### Minimum Threshold

When HIPAA mode is enabled:
- Data with counts < threshold is aggregated
- Default threshold: 5 records
- Configurable via `HIPAA_MIN_THRESHOLD`

### Redaction Examples

```sql
-- Before redaction
SELECT 
  applicant_name,
  email,
  facility_id,
  total_applications
FROM analytics_view;

-- After redaction (for non-PII users)
SELECT 
  '[REDACTED]' as applicant_name,
  '[REDACTED]' as email,
  facility_id,
  total_applications
FROM analytics_view;
```

## API Integration

### Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/analytics/pipeline` | GET | Pipeline metrics |
| `/api/v1/analytics/compliance` | GET | Compliance metrics |
| `/api/v1/analytics/revenue` | GET | Revenue metrics |
| `/api/v1/analytics/outreach` | GET | Outreach metrics |
| `/api/v1/analytics/kpis` | GET | Combined KPIs |
| `/api/v1/analytics/refresh` | POST | Trigger refresh |
| `/api/v1/analytics/health` | GET | System health |

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | string | ISO date string (YYYY-MM-DD) |
| `endDate` | string | ISO date string (YYYY-MM-DD) |
| `facilityId` | string | Facility filter (admin only) |
| `includePII` | boolean | Include PII data |

### Response Format

```json
{
  "success": true,
  "data": {
    // KPI data here
  },
  "cached": false,
  "timestamp": "2023-11-09T19:57:00.000Z"
}
```

## Troubleshooting

### Common Issues

#### Materialized View Refresh Fails
```sql
-- Check for locks
SELECT * FROM pg_locks WHERE relation IN (
  SELECT oid FROM pg_class WHERE relname LIKE '%_materialized'
);

-- Force refresh (may cause downtime)
REFRESH MATERIALIZED VIEW analytics.pipeline_kpis_materialized;
```

#### Performance Issues
```sql
-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements 
WHERE query LIKE '%analytics.%'
ORDER BY total_time DESC
LIMIT 10;
```

#### Data Inconsistency
```sql
-- Verify view definitions
\d+ analytics.pipeline_kpis_materialized

-- Check for missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats 
WHERE schemaname = 'analytics';
```

## Future Enhancements

### Planned Features

1. **Real-time Analytics**: Stream processing for live dashboards
2. **Predictive Analytics**: ML models for hiring predictions
3. **Advanced Segmentation**: Demographic and geographic analysis
4. **Custom KPIs**: User-defined metrics and calculations
5. **Data Export**: CSV, Excel, and PDF report generation
6. **Alerting**: Automated notifications for KPI thresholds

### Scalability Considerations

1. **Partitioning**: Time-based partitioning for large tables
2. **Read Replicas**: Separate read replicas for analytics queries
3. **Caching Layers**: Multiple cache tiers for different data types
4. **Columnar Storage**: Consider columnar storage for analytics
5. **Data Archiving**: Archive old data to maintain performance
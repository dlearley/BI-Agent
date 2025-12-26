# Alerts and Reports System

This document describes the alerts and reports backend implementation for the analytics service.

## Overview

The system provides comprehensive alerting and reporting capabilities with:
- **Alerts**: Threshold, percent change, and anomaly detection alerts
- **Reports**: Scheduled and on-demand report generation with AI narratives
- **Delivery Channels**: Slack, Email (SMTP), and generic webhooks
- **Background Jobs**: Celery-style (BullMQ) scheduled tasks for periodic evaluation

## Features

### Alerts

#### Alert Types

1. **Threshold Alerts**
   - Trigger when a metric crosses a specific threshold
   - Configurable operators: `>`, `<`, `>=`, `<=`, `=`
   - Example: Alert when revenue exceeds $100,000

2. **Percent Change Alerts**
   - Trigger when a metric changes by a certain percentage
   - Configurable periods: daily, weekly, monthly
   - Direction: increase, decrease, or any change
   - Example: Alert when revenue drops by more than 10% week-over-week

3. **Anomaly Detection Alerts**
   - Uses ML service for statistical anomaly detection
   - Configurable sensitivity: low, medium, high
   - Lookback period: number of days of historical data to analyze
   - Example: Alert on unexpected compliance rate deviations

#### Delivery Channels

1. **Slack**
   ```json
   {
     "type": "slack",
     "webhookUrl": "https://hooks.slack.com/services/...",
     "channel": "#alerts",
     "username": "Analytics Bot",
     "iconEmoji": ":chart_with_upwards_trend:"
   }
   ```

2. **Email (SMTP)**
   ```json
   {
     "type": "email",
     "recipients": ["admin@example.com", "team@example.com"],
     "subject": "Alert Triggered",
     "cc": ["manager@example.com"],
     "bcc": ["archive@example.com"]
   }
   ```

3. **Generic Webhook**
   ```json
   {
     "type": "webhook",
     "url": "https://api.example.com/webhook",
     "method": "POST",
     "headers": {
       "Authorization": "Bearer token123",
       "Content-Type": "application/json"
     }
   }
   ```

#### Alert Evaluation

- **Scheduled Evaluation**: Alerts are evaluated on a schedule (hourly, daily, weekly)
- **Manual Evaluation**: Test alerts on-demand via API endpoint
- **Audit Logging**: All notifications are logged for compliance

### Reports

#### Report Types

1. **Weekly Briefing**
   - Automatically generated every Monday at 9 AM
   - Includes last week's performance
   - AI-generated executive summary

2. **Monthly Summary**
   - Generated on the first day of each month
   - Comprehensive monthly metrics
   - Trend analysis and insights

3. **Custom Reports**
   - On-demand or custom schedule
   - Configurable date ranges and metrics

#### Report Components

1. **AI-Generated Narrative**
   - Uses OpenAI GPT-4 for insights generation
   - Contextual analysis of metrics
   - Actionable recommendations
   - Falls back to template-based narrative if LLM unavailable

2. **Chart Snapshots**
   - Revenue overview with facility and monthly breakdowns
   - Pipeline metrics and time-to-fill
   - Compliance status and violation tracking
   - Outreach effectiveness by channel

3. **PDF Generation**
   - Professional formatting
   - Embedded charts and data
   - Configurable storage location
   - Attachment support for email delivery

## API Endpoints

### Alerts

```typescript
// Create alert
POST /api/v1/alerts
{
  "name": "High Revenue Alert",
  "description": "Alert when revenue exceeds threshold",
  "metric": "revenue",
  "alertType": "threshold",
  "thresholdValue": 100000,
  "thresholdOperator": ">",
  "evaluationFrequency": "daily",
  "evaluationSchedule": "0 9 * * *",
  "channels": [...]
}

// List alerts
GET /api/v1/alerts?enabled=true&facilityId=abc-123

// Get alert by ID
GET /api/v1/alerts/:id

// Update alert
PUT /api/v1/alerts/:id
{
  "name": "Updated Alert Name",
  "enabled": false
}

// Delete alert
DELETE /api/v1/alerts/:id

// Test/evaluate alert manually
POST /api/v1/alerts/:id/test

// Get notification history
GET /api/v1/alerts/:id/notifications?limit=50
```

### Reports

```typescript
// Create report
POST /api/v1/reports
{
  "name": "Weekly Analytics Briefing",
  "reportType": "weekly_briefing",
  "schedule": "0 9 * * 1",
  "metrics": ["revenue", "pipeline_count", "compliance_rate"],
  "dateRangeType": "last_week",
  "includeCharts": true,
  "includeNarrative": true,
  "channels": [...]
}

// List reports
GET /api/v1/reports?enabled=true

// Get report by ID
GET /api/v1/reports/:id

// Update report
PUT /api/v1/reports/:id

// Delete report
DELETE /api/v1/reports/:id

// Generate and send report immediately
POST /api/v1/reports/send-now
{
  "reportId": "abc-123",
  // OR custom ad-hoc report
  "dateRangeStart": "2024-01-01",
  "dateRangeEnd": "2024-01-07",
  "metrics": ["revenue", "compliance_rate"],
  "deliveryChannels": [...]
}

// List report generations (history)
GET /api/v1/reports/:id/generations?limit=20

// Get specific generation
GET /api/v1/reports/generations/:id
```

## Configuration

### Environment Variables

```bash
# Alerts Configuration
ALERTS_ENABLED=true
ALERTS_EVALUATION_INTERVAL=300000  # 5 minutes
ALERTS_MAX_RETRIES=3

# Reports Configuration
REPORTS_ENABLED=true
REPORTS_STORAGE_DIR=./reports
REPORTS_MAX_FILE_SIZE_MB=10

# Email/SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=analytics@example.com

# OpenAI Configuration (for AI narratives)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4-turbo-preview
OPENAI_MAX_TOKENS=2000
```

## Database Schema

### Alerts Table
```sql
CREATE TABLE alerts (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  metric VARCHAR(100) NOT NULL,
  alert_type VARCHAR(50) NOT NULL,
  threshold_value DECIMAL(15, 2),
  threshold_operator VARCHAR(10),
  percent_change_value DECIMAL(10, 2),
  anomaly_sensitivity VARCHAR(20),
  evaluation_frequency VARCHAR(50) NOT NULL,
  channels JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_evaluated_at TIMESTAMP,
  last_triggered_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Alert Notifications Table
```sql
CREATE TABLE alert_notifications (
  id UUID PRIMARY KEY,
  alert_id UUID REFERENCES alerts(id),
  triggered_at TIMESTAMP DEFAULT NOW(),
  metric_value DECIMAL(15, 2),
  channel_type VARCHAR(50),
  status VARCHAR(50),
  sent_at TIMESTAMP,
  error_message TEXT
);
```

### Reports Table
```sql
CREATE TABLE reports (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  schedule VARCHAR(100) NOT NULL,
  metrics JSONB NOT NULL,
  date_range_type VARCHAR(50),
  channels JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Report Generations Table
```sql
CREATE TABLE report_generations (
  id UUID PRIMARY KEY,
  report_id UUID REFERENCES reports(id),
  generated_at TIMESTAMP DEFAULT NOW(),
  narrative TEXT,
  charts JSONB,
  pdf_url VARCHAR(500),
  status VARCHAR(50),
  recipients JSONB
);
```

## Background Jobs

### Alert Evaluation Jobs

- Powered by BullMQ (Redis-backed job queue)
- Scheduled based on alert `evaluationFrequency` and `evaluationSchedule`
- Automatic retry on failure (configurable)
- Concurrent processing (5 workers)

```typescript
// Schedule alert evaluations
await scheduleAlertEvaluations();

// Manually trigger alert evaluation
await triggerAlertEvaluation(alertId);
```

### Report Generation Jobs

- Weekly briefings: Every Monday at 9 AM
- Monthly summaries: First day of month at 9 AM
- Custom schedules via cron expressions
- Concurrent processing (2 workers to limit resource usage)

```typescript
// Schedule report generations
await scheduleReportGenerations();

// Manually trigger report generation
await triggerReportGeneration(reportId);
```

## Testing

### Integration Tests

The system includes comprehensive integration tests:

#### Alert Tests (`src/test/integration/alerts.test.ts`)
- Create alerts of all types (threshold, percent change, anomaly)
- List and filter alerts
- Update and delete alerts
- Test alert evaluation
- Verify notification delivery (Slack, Email)
- Check notification history

#### Report Tests (`src/test/integration/reports.test.ts`)
- Create different report types
- Generate reports on-demand
- Verify PDF generation
- Test AI narrative generation
- Verify multi-channel delivery
- Check report history

### Running Tests

```bash
# Run all tests
npm test

# Run integration tests only
npm test -- src/test/integration

# Run with coverage
npm run test:coverage
```

### Mocking

Tests use mocked services for:
- **Notification Service**: Mock Slack/Email delivery
- **OpenAI**: Mock LLM API calls
- **Analytics Data**: Use test data from database

## Usage Examples

### Example 1: Revenue Threshold Alert

```bash
curl -X POST http://localhost:3000/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Revenue Alert",
    "metric": "revenue",
    "alertType": "threshold",
    "thresholdValue": 100000,
    "thresholdOperator": ">",
    "evaluationFrequency": "daily",
    "evaluationSchedule": "0 9 * * *",
    "channels": [{
      "type": "slack",
      "webhookUrl": "https://hooks.slack.com/services/YOUR/WEBHOOK/URL",
      "channel": "#finance-alerts"
    }]
  }'
```

### Example 2: Compliance Drop Alert

```bash
curl -X POST http://localhost:3000/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Compliance Rate Drop",
    "metric": "compliance_rate",
    "alertType": "percent_change",
    "percentChangeValue": 5,
    "percentChangePeriod": "weekly",
    "percentChangeDirection": "decrease",
    "evaluationFrequency": "daily",
    "evaluationSchedule": "0 8 * * *",
    "channels": [{
      "type": "email",
      "recipients": ["compliance@example.com", "manager@example.com"]
    }]
  }'
```

### Example 3: Weekly Report

```bash
curl -X POST http://localhost:3000/api/v1/reports \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Executive Weekly Briefing",
    "reportType": "weekly_briefing",
    "schedule": "0 9 * * 1",
    "metrics": ["revenue", "pipeline_count", "compliance_rate", "outreach_response_rate"],
    "dateRangeType": "last_week",
    "includeCharts": true,
    "includeNarrative": true,
    "channels": [{
      "type": "email",
      "recipients": ["ceo@example.com", "cfo@example.com"],
      "subject": "Weekly Analytics Briefing"
    }]
  }'
```

### Example 4: Ad-hoc Report Generation

```bash
curl -X POST http://localhost:3000/api/v1/reports/send-now \
  -H "Content-Type: application/json" \
  -d '{
    "dateRangeStart": "2024-01-01",
    "dateRangeEnd": "2024-01-31",
    "metrics": ["revenue", "compliance_rate"],
    "deliveryChannels": [{
      "type": "email",
      "recipients": ["analyst@example.com"]
    }]
  }'
```

## Acceptance Criteria

✅ **Alert triggers on threshold breach**
- Threshold, percent change, and anomaly alerts implemented
- Evaluation logic tested and validated

✅ **Slack message delivered**
- Slack webhook integration complete
- Notifications tested with mock Slack service

✅ **Weekly report generated with narrative + chart snapshots**
- Reports scheduled via BullMQ
- AI narrative generation via OpenAI GPT-4
- PDF generation with embedded charts
- Email delivery with PDF attachments

## Monitoring and Observability

- All alert evaluations logged
- Notification delivery status tracked
- Report generation metrics captured
- Failed jobs automatically retried
- Audit trail maintained in database

## Future Enhancements

- Advanced anomaly detection algorithms
- Custom metric definitions
- Alert escalation policies
- Report templates and customization
- Dashboard for alert/report management
- Webhook signature verification
- Rate limiting for notifications
- Alert dependencies and workflows

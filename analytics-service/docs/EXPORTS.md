# Analytics Exports

This module provides comprehensive analytics export functionality with scheduling, multiple output formats, and delivery options.

## Features

- **Scheduled Exports**: Create recurring export schedules using cron expressions
- **Multiple Formats**: Export data as CSV or PDF
- **Delivery Options**: Send exports via email or Slack
- **Secure Storage**: Files stored in S3 with server-side encryption
- **Access Control**: RBAC-compliant with audit logging
- **Error Handling**: Automatic retry with detailed error reporting

## API Endpoints

### Export Schedules

- `GET /api/v1/exports/schedules` - List all export schedules
- `POST /api/v1/exports/schedules` - Create new export schedule
- `GET /api/v1/exports/schedules/:id` - Get specific export schedule
- `PUT /api/v1/exports/schedules/:id` - Update export schedule
- `DELETE /api/v1/exports/schedules/:id` - Delete export schedule

### Export Jobs

- `GET /api/v1/exports/jobs` - List all export jobs
- `POST /api/v1/exports/jobs` - Create immediate export job
- `GET /api/v1/exports/jobs/:id` - Get specific export job
- `GET /api/v1/exports/jobs/:id/status` - Get job processing status
- `GET /api/v1/exports/jobs/:id/download` - Get download link
- `POST /api/v1/exports/jobs/:id/retry` - Retry failed job
- `POST /api/v1/exports/jobs/:id/cancel` - Cancel running job

### Queue Management (Admin Only)

- `GET /api/v1/exports/queue/stats` - Get queue statistics

## Configuration

### Environment Variables

```bash
# S3 Configuration
S3_BUCKET=analytics-exports
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=your-access-key
S3_SECRET_ACCESS_KEY=your-secret-key
S3_ENDPOINT= # Optional: for S3-compatible services

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
FROM_EMAIL=analytics@example.com
FROM_NAME=Analytics Service

# Slack Configuration
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Export Settings
EXPORT_MAX_FILE_SIZE=104857600  # 100MB
EXPORT_SIGNED_URL_TTL=3600     # 1 hour
EXPORT_RETENTION_DAYS=90
```

## Usage Examples

### Create Export Schedule

```json
{
  "name": "Weekly KPI Report",
  "description": "Weekly KPI analytics report",
  "exportType": "kpi",
  "format": "csv",
  "scheduleExpression": "0 9 * * 1",
  "filters": {
    "startDate": "2023-01-01",
    "endDate": "2023-12-31"
  },
  "templateData": {
    "subject": "Weekly KPI Report",
    "body": "Please find attached the weekly KPI report.",
    "includeAttachment": true,
    "attachmentName": "kpi_report.csv"
  },
  "recipients": [
    {
      "recipientType": "email",
      "recipientAddress": "manager@example.com"
    }
  ]
}
```

### Create Immediate Export

```json
{
  "exportType": "dashboard",
  "format": "pdf",
  "filters": {
    "startDate": "2023-01-01",
    "endDate": "2023-12-31"
  }
}
```

## Export Types

- `dashboard` - Complete dashboard analytics
- `kpi` - Key performance indicators
- `compliance` - Compliance metrics
- `revenue` - Revenue analytics
- `outreach` - Outreach effectiveness

## Export Formats

- `csv` - Comma-separated values
- `pdf` - Portable document format

## Cron Expression Examples

- `0 9 * * 1` - Every Monday at 9:00 AM
- `0 0 1 * *` - First day of every month at midnight
- `0 */6 * * *` - Every 6 hours
- `0 9 1,15 * *` - 1st and 15th of every month at 9:00 AM

## Security Features

- **RBAC**: Role-based access control
- **HIPAA Compliance**: Audit logging and data protection
- **Encryption**: Server-side encryption for S3 storage
- **Signed URLs**: Temporary secure download links
- **Row-Level Security**: Users can only access their own exports

## Error Handling

- Export jobs automatically retry on failure
- Detailed error messages logged and returned
- Failed jobs can be manually retried
- Queue monitoring and statistics available

## Monitoring

Export jobs are tracked through:

- Database records for job status and history
- Queue statistics for processing metrics
- Audit logs for compliance
- Error tracking and alerting

## File Storage

Export files are stored in S3 with:

- Server-side encryption (AES-256)
- Organized by export type and date
- Automatic cleanup after retention period
- Temporary signed URLs for secure access

## Notifications

### Email Templates

```json
{
  "subject": "Analytics Export Ready",
  "body": "Your analytics export is ready. Download: {{FILE_URL}}",
  "includeAttachment": true,
  "attachmentName": "analytics_export.csv"
}
```

### Slack Templates

```json
{
  "message": "Analytics export is ready: {{FILE_URL}}",
  "channel": "#analytics",
  "includeFile": false,
  "fileName": "analytics_export.csv"
}
```
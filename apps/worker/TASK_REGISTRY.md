# Celery Worker Task Registry

This document provides a comprehensive overview of all Celery tasks available in the analytics worker system.

## Task Categories

### 1. Analytics Tasks (`apps.worker.tasks.analytics`)

#### `refresh_catalog`
- **Purpose**: Refresh the analytics catalog metadata
- **Schedule**: Every 5 minutes
- **Queue**: `analytics`
- **Retry Policy**: 3 retries with exponential backoff (max 300s)
- **Circuit Breaker**: Database circuit breaker (5 failures, 60s recovery)
- **Returns**: Catalog refresh statistics

```python
# Manual execution
from apps.worker.tasks.analytics import refresh_catalog
result = refresh_catalog.delay()
```

#### `refresh_materialized_views`
- **Purpose**: Refresh materialized views for analytics
- **Parameters**: `view_names` (Optional[List[str]]) - Specific views to refresh
- **Schedule**: Hourly
- **Queue**: `analytics`
- **Retry Policy**: 3 retries with exponential backoff (max 600s)
- **Circuit Breaker**: Database circuit breaker
- **Returns**: Refresh results with timing information

```python
# Refresh all views
from apps.worker.tasks.analytics import refresh_materialized_views
result = refresh_materialized_views.delay()

# Refresh specific views
result = refresh_materialized_views.delay(['pipeline_kpis', 'revenue_kpis'])
```

#### `update_query_statistics`
- **Purpose**: Update query performance statistics
- **Schedule**: Manual
- **Queue**: `analytics`
- **Retry Policy**: 2 retries with exponential backoff
- **Circuit Breaker**: Database circuit breaker
- **Returns**: Statistics update results

#### `cleanup_old_refresh_logs`
- **Purpose**: Clean up old refresh logs to prevent table bloat
- **Schedule**: Manual
- **Queue**: `analytics`
- **Retry Policy**: No retry (cleanup tasks)
- **Returns**: Cleanup statistics

---

### 2. dbt Tasks (`apps.worker.tasks.dbt_tasks`)

#### `run_dbt_models`
- **Purpose**: Run dbt models with specified arguments
- **Parameters**: `dbt_args` (List[str]) - dbt command arguments
- **Schedule**: Daily at 2 AM
- **Queue**: `dbt`
- **Retry Policy**: 2 retries with exponential backoff (max 600s)
- **Circuit Breaker**: dbt circuit breaker (3 failures, 120s recovery)
- **Timeout**: 1 hour
- **Returns**: dbt execution results

```python
# Run all models
from apps.worker.tasks.dbt_tasks import run_dbt_models
result = run_dbt_models.delay()

# Run specific models
result = run_dbt_models.delay(['--models', 'staging', 'kpis'])
```

#### `run_dbt_tests`
- **Purpose**: Run dbt tests
- **Parameters**: `dbt_args` (List[str]) - dbt test arguments
- **Schedule**: Daily at 3 AM
- **Queue**: `dbt`
- **Retry Policy**: 2 retries with exponential backoff
- **Circuit Breaker**: dbt circuit breaker
- **Timeout**: 30 minutes
- **Returns**: dbt test results

#### `dbt_docs_generate`
- **Purpose**: Generate dbt documentation
- **Schedule**: Manual
- **Queue**: `dbt`
- **Retry Policy**: 1 retry
- **Circuit Breaker**: dbt circuit breaker
- **Timeout**: 10 minutes
- **Returns**: Documentation generation results

#### `dbt_freshness_check`
- **Purpose**: Check data freshness for dbt sources
- **Parameters**: `source_names` (Optional[List[str]]) - Specific sources to check
- **Schedule**: Manual
- **Queue**: `dbt`
- **Retry Policy**: 1 retry
- **Circuit Breaker**: dbt circuit breaker
- **Timeout**: 5 minutes
- **Returns**: Freshness check results

---

### 3. Alert Tasks (`apps.worker.tasks.alerts`)

#### `process_pending_alerts`
- **Purpose**: Process all pending alerts that need to be evaluated
- **Schedule**: Every 2 minutes
- **Queue**: `alerts`
- **Retry Policy**: 3 retries with exponential backoff
- **Circuit Breaker**: Database circuit breaker
- **Returns**: Alert processing statistics

#### `trigger_alert`
- **Purpose**: Trigger an alert and send notifications
- **Parameters**: `alert_data` (Dict[str, Any]) - Alert configuration
- **Schedule**: Event-driven
- **Queue**: `alerts`
- **Retry Policy**: 2 retries
- **Circuit Breaker**: Database circuit breaker
- **Returns**: Alert trigger results

#### `check_threshold_conditions`
- **Purpose**: Check threshold conditions for all active metrics
- **Schedule**: Every 5 minutes
- **Queue**: `alerts`
- **Retry Policy**: 2 retries with exponential backoff
- **Circuit Breaker**: Database circuit breaker
- **Returns**: Threshold check results

#### `create_threshold_alert`
- **Purpose**: Create and trigger an alert for threshold breach
- **Parameters**: 
  - `threshold_data` (Dict[str, Any]) - Threshold configuration
  - `current_value` (float) - Current metric value
  - `status` (str) - Alert status (warning/critical)
- **Schedule**: Event-driven
- **Queue**: `alerts`
- **Retry Policy**: No retry
- **Returns**: Alert creation results

---

### 4. Report Tasks (`apps.worker.tasks.reports`)

#### `generate_scheduled_reports`
- **Purpose**: Generate scheduled reports based on schedule type
- **Parameters**: `schedule_type` (str) - 'daily', 'weekly', or 'monthly'
- **Schedule**: 
  - Daily: 6 AM
  - Weekly: Monday 8 AM
- **Queue**: `reports`
- **Retry Policy**: 2 retries with exponential backoff (max 120s)
- **Circuit Breaker**: Database circuit breaker
- **Returns**: Report generation statistics

```python
# Generate daily reports
from apps.worker.tasks.reports import generate_scheduled_reports
result = generate_scheduled_reports.delay('daily')

# Generate weekly reports
result = generate_scheduled_reports.delay('weekly')
```

#### `generate_single_report`
- **Purpose**: Generate a single report
- **Parameters**: `report_data` (Dict[str, Any]) - Report configuration
- **Schedule**: Event-driven
- **Queue**: `reports`
- **Retry Policy**: 2 retries with exponential backoff
- **Circuit Breaker**: Database circuit breaker
- **Returns**: Single report generation results

#### `cleanup_old_reports`
- **Purpose**: Clean up old report files based on retention policy
- **Schedule**: Manual
- **Queue**: `reports`
- **Retry Policy**: 1 retry
- **Returns**: Cleanup statistics

#### `generate_ad_hoc_report`
- **Purpose**: Generate an ad-hoc report based on provided configuration
- **Parameters**: `report_config` (Dict[str, Any]) - Report configuration
- **Schedule**: On-demand
- **Queue**: `reports`
- **Retry Policy**: No retry
- **Returns**: Ad-hoc report generation results

---

### 5. Monitoring Tasks (`apps.worker.tasks.monitoring`)

#### `collect_worker_metrics`
- **Purpose**: Collect system and worker metrics for monitoring
- **Schedule**: Every minute
- **Queue**: `monitoring`
- **Retry Policy**: No retry
- **Returns**: System and worker metrics

#### `health_check`
- **Purpose**: Perform comprehensive health check of the worker system
- **Schedule**: Every 5 minutes
- **Queue**: `monitoring`
- **Retry Policy**: No retry
- **Returns**: Health check results

#### `cleanup_expired_tasks`
- **Purpose**: Clean up expired tasks and results from Redis
- **Schedule**: Manual
- **Queue**: `monitoring`
- **Retry Policy**: No retry
- **Returns**: Cleanup statistics

#### `update_task_statistics`
- **Purpose**: Update task execution statistics for monitoring
- **Schedule**: Manual
- **Queue**: `monitoring`
- **Retry Policy**: No retry
- **Returns**: Task statistics

---

## Task Configuration

### Retry Policies

All tasks follow a consistent retry strategy:

1. **Exponential Backoff**: Retry delay increases exponentially
2. **Maximum Backoff**: Capped at configurable maximum (typically 300-600s)
3. **Jitter**: Random variation to prevent thundering herd
4. **Circuit Breaker**: Tasks fail fast when downstream services are unhealthy

### Concurrency Limits

Each queue has specific concurrency limits:

| Queue | Default Concurrency | Purpose |
|--------|-------------------|---------|
| analytics | 2 | General analytics tasks |
| dbt | 1 | Resource-intensive dbt operations |
| alerts | 4 | Quick alert processing |
| reports | 2 | Report generation |
| monitoring | 1 | System monitoring |

### Circuit Breaker Configuration

Circuit breakers protect against cascading failures:

- **Database**: 5 failures, 60s recovery timeout
- **dbt**: 3 failures, 120s recovery timeout  
- **External APIs**: 3 failures, 120s recovery timeout

---

## Monitoring and Metrics

### Prometheus Metrics

All tasks expose comprehensive Prometheus metrics:

- **Task Counters**: Total tasks processed by status
- **Task Durations**: Histogram of task execution times
- **Retry Counters**: Number of task retries
- **Queue Metrics**: Queue sizes and processing rates
- **System Metrics**: CPU, memory, disk usage
- **Database Metrics**: Connection times, query durations

### Health Checks

The health check task monitors:

- Database connectivity and performance
- Redis connectivity (Celery broker)
- System resource usage
- Worker process health
- External service availability

---

## Usage Examples

### Manual Task Execution

```python
from apps.worker.tasks.analytics import refresh_materialized_views
from apps.worker.tasks.dbt_tasks import run_dbt_models
from apps.worker.tasks.alerts import process_pending_alerts
from apps.worker.tasks.reports import generate_ad_hoc_report

# Refresh specific views
refresh_result = refresh_materialized_views.delay(['pipeline_kpis'])

# Run dbt models
dbt_result = run_dbt_models.delay(['--models', 'staging'])

# Process alerts
alert_result = process_pending_alerts.delay()

# Generate ad-hoc report
report_config = {
    'name': 'Custom Report',
    'query': 'SELECT * FROM analytics_pipeline_kpis LIMIT 100',
    'format': 'csv',
    'recipients': ['admin@example.com']
}
report_result = generate_ad_hoc_report.delay(report_config)
```

### Task Result Handling

```python
# Get task result
result = refresh_result.get(timeout=300)  # Wait 5 minutes

if result['status'] == 'success':
    print(f"Task completed: {result['message']}")
    print(f"Summary: {result['summary']}")
else:
    print(f"Task failed: {result.get('error', 'Unknown error')}")
```

### Monitoring Task Status

```python
# Check if task is still running
if refresh_result.ready():
    if refresh_result.successful():
        result = refresh_result.get()
        print("Task succeeded")
    else:
        print("Task failed")
        print(f"Error: {refresh_result.result}")
else:
    print("Task still running...")
```

---

## Beat Schedule Configuration

The Celery beat scheduler is configured with the following schedule:

```python
beat_schedule = {
    # Analytics tasks
    'refresh-catalog-every-5-minutes': {
        'task': 'apps.worker.tasks.analytics.refresh_catalog',
        'schedule': 300.0,
        'options': {'queue': 'analytics'}
    },
    'refresh-materialized-views-hourly': {
        'task': 'apps.worker.tasks.analytics.refresh_materialized_views',
        'schedule': 3600.0,
        'options': {'queue': 'analytics'}
    },
    
    # dbt tasks
    'run-dbt-models-daily': {
        'task': 'apps.worker.tasks.dbt_tasks.run_dbt_models',
        'schedule': 86400.0,
        'options': {'queue': 'dbt'},
        'args': (['--models', 'staging', 'kpis'],)
    },
    
    # Alert tasks
    'process-alerts-every-2-minutes': {
        'task': 'apps.worker.tasks.alerts.process_pending_alerts',
        'schedule': 120.0,
        'options': {'queue': 'alerts'}
    },
    
    # Report tasks
    'generate-daily-reports': {
        'task': 'apps.worker.tasks.reports.generate_scheduled_reports',
        'schedule': 86400.0,
        'options': {'queue': 'reports'},
        'args': ('daily',)
    },
    
    # Monitoring tasks
    'collect-metrics-every-minute': {
        'task': 'apps.worker.tasks.monitoring.collect_worker_metrics',
        'schedule': 60.0,
        'options': {'queue': 'monitoring'}
    }
}
```

---

## Error Handling and Troubleshooting

### Common Issues

1. **Database Connection Failures**: Check database circuit breaker status
2. **dbt Execution Failures**: Verify dbt project configuration and dependencies
3. **Alert Notification Failures**: Check SMTP/webhook configurations
4. **Report Generation Failures**: Verify output directory permissions

### Debugging

```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Check task execution details
result = refresh_result.get()
print(f"Task result: {result}")

# Check circuit breaker status
from apps.worker.utils.circuit_breaker import db_circuit_breaker
print(f"DB Circuit Breaker: {db_circuit_breaker.get_stats()}")
```

### Monitoring

- **Flower**: http://localhost:5555 - Real-time task monitoring
- **Prometheus**: http://localhost:8000 - Metrics endpoint
- **Logs**: `$LOG_DIR/worker-*.log` - Worker log files

---

## Configuration

All task behavior can be configured through environment variables:

- Database: `DATABASE_URL`
- Redis: `REDIS_URL`, `CELERY_BROKER_URL`, `CELERY_RESULT_BACKEND`
- dbt: `DBT_PROJECT_PATH`, `DBT_PROFILES_DIR`
- Monitoring: `PROMETHEUS_PORT`, `FLOWER_PORT`
- Alerts: `ALERT_WEBHOOK_URL`, `ALERT_EMAIL_*`
- Reports: `REPORT_OUTPUT_DIR`, `REPORT_RETENTION_DAYS`

See `.env.example` for complete configuration options.
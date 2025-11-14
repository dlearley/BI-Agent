# Celery Worker for Analytics Platform

This directory contains a complete Python Celery worker implementation for handling analytics tasks, including query refreshes, materializations, dbt runs, alerts, and reports.

## Features

- **Task Scheduling**: Comprehensive Celery beat schedule for all analytics operations
- **Retry & Backoff**: Configurable retry policies with exponential backoff
- **Circuit Breakers**: Protection against cascading failures using Redis
- **Monitoring**: Prometheus metrics collection and Flower monitoring
- **Alerts**: Multi-channel alerting (email, webhook, Slack)
- **Reports**: Automated report generation and delivery
- **dbt Integration**: Run dbt models, tests, and documentation generation

## Quick Start

### 1. Setup

```bash
cd apps/worker
./workerctl.sh setup
```

This will:
- Create a Python virtual environment
- Install all dependencies
- Create necessary directories
- Set up environment configuration

### 2. Configure Environment

Edit the `.env` file with your configuration:

```bash
cp .env.example .env
# Edit .env with your settings
```

Key settings:
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_URL`: Redis connection string
- `DBT_PROJECT_PATH`: Path to dbt project
- `ALERT_EMAIL_*`: Email notification settings
- `ALERT_WEBHOOK_URL`: Webhook URL for alerts

### 3. Start Services

```bash
# Start all services
./workerctl.sh start-all

# Or start individual services
./workerctl.sh start-worker analytics
./workerctl.sh start-beat
./workerctl.sh start-flower
./workerctl.sh start-metrics
```

### 4. Monitor Services

- **Flower Monitoring**: http://localhost:5555
- **Prometheus Metrics**: http://localhost:8000
- **Service Status**: `./workerctl.sh status`

## Architecture

### Task Queues

The worker uses separate queues for different task types:

| Queue | Purpose | Concurrency |
|--------|---------|-------------|
| analytics | Catalog refreshes, materialized views | 2 |
| dbt | dbt model runs, tests, docs | 1 |
| alerts | Alert processing, notifications | 4 |
| reports | Report generation, delivery | 2 |
| monitoring | Health checks, metrics collection | 1 |

### Task Categories

1. **Analytics Tasks** (`tasks/analytics.py`)
   - Refresh catalog metadata
   - Update materialized views
   - Update query statistics
   - Cleanup old logs

2. **dbt Tasks** (`tasks/dbt_tasks.py`)
   - Run dbt models
   - Execute dbt tests
   - Generate documentation
   - Check data freshness

3. **Alert Tasks** (`tasks/alerts.py`)
   - Process pending alerts
   - Check threshold conditions
   - Send notifications
   - Create threshold alerts

4. **Report Tasks** (`tasks/reports.py`)
   - Generate scheduled reports
   - Handle ad-hoc reports
   - Deliver reports via email/S3
   - Cleanup old reports

5. **Monitoring Tasks** (`tasks/monitoring.py`)
   - Collect system metrics
   - Perform health checks
   - Update task statistics
   - Cleanup expired tasks

### Circuit Breakers

Circuit breakers protect against cascading failures:

- **Database Circuit Breaker**: 5 failures, 60s recovery
- **dbt Circuit Breaker**: 3 failures, 120s recovery
- **External API Circuit Breaker**: 3 failures, 120s recovery

### Retry Policies

All tasks use configurable retry policies:
- Exponential backoff with jitter
- Maximum retry delays (300-600s)
- Queue-specific retry limits
- Automatic circuit breaker integration

## Management

### Control Script (`workerctl.sh`)

The `workerctl.sh` script provides comprehensive service management:

```bash
# Setup environment
./workerctl.sh setup

# Service management
./workerctl.sh start-all
./workerctl.sh stop-all
./workerctl.sh restart-all

# Individual services
./workerctl.sh start-worker analytics 4
./workerctl.sh stop-worker analytics
./workerctl.sh start-beat
./workerctl.sh stop-beat

# Monitoring
./workerctl.sh status
```

### Environment Variables

Configure behavior through environment variables:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/db

# Redis
REDIS_URL=redis://localhost:6379/0

# dbt
DBT_PROJECT_PATH=/path/to/dbt
DBT_PROFILES_DIR=/path/to/profiles

# Monitoring
PROMETHEUS_PORT=8000
FLOWER_PORT=5555

# Alerts
ALERT_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL_SMTP_HOST=smtp.gmail.com

# Concurrency
WORKER_CONCURRENCY_ANALYTICS=2
WORKER_CONCURRENCY_DBT=1
WORKER_CONCURRENCY_ALERTS=4
```

## Monitoring

### Prometheus Metrics

Comprehensive metrics are exposed at `http://localhost:8000/metrics`:

- Task execution metrics (counters, histograms)
- System resource metrics (CPU, memory, disk)
- Database performance metrics
- Queue size and processing metrics
- Alert and report generation metrics

### Flower Monitoring

Real-time task monitoring at `http://localhost:5555`:

- Active workers and tasks
- Task history and results
- Queue statistics
- Worker performance

### Logging

Logs are organized by service:

```
logs/
├── worker-analytics.log
├── worker-dbt.log
├── worker-alerts.log
├── worker-reports.log
├── worker-monitoring.log
├── beat.log
├── flower.log
└── metrics.log
```

## Task Registry

Complete task documentation is available in [TASK_REGISTRY.md](./TASK_REGISTRY.md), including:

- Task descriptions and parameters
- Retry policies and circuit breaker settings
- Usage examples and code snippets
- Monitoring and troubleshooting guides

## Integration

### With Existing Node.js Service

The Celery worker complements the existing Node.js analytics service:

- **Node.js**: API endpoints, real-time queries, caching
- **Celery**: Background processing, scheduled tasks, heavy computations

### Database Schema

The worker creates additional tables for analytics management:

- `analytics_catalog`: Metadata catalog
- `analytics_alerts`: Alert configurations
- `analytics_reports`: Report definitions
- `analytics_refresh_log`: Refresh history
- `worker_metrics`: Performance metrics
- `task_statistics`: Execution statistics

### API Integration

The worker can communicate with the main analytics service:

```python
# Example: Trigger refresh from API
import httpx

response = httpx.post(
    f"{settings.analytics_api_url}/api/v1/analytics/refresh",
    headers={"Authorization": f"Bearer {token}"}
)
```

## Development

### Adding New Tasks

1. Create task in appropriate module (`tasks/`)
2. Add to Celery app includes in `celery_app.py`
3. Configure queue routing
4. Add to beat schedule if needed
5. Update task registry documentation

### Testing

```bash
# Run tests
python -m pytest tests/

# Run with coverage
python -m pytest --cov=apps tests/
```

### Debugging

```python
# Enable debug logging
import logging
logging.basicConfig(level=logging.DEBUG)

# Check circuit breaker status
from apps.worker.utils.circuit_breaker import db_circuit_breaker
print(db_circuit_breaker.get_stats())
```

## Production Deployment

### Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
CMD ["python", "worker.py"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  celery-worker:
    build: ./apps/worker
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    volumes:
      - ./reports:/tmp/reports
      - ./logs:/app/logs
    depends_on:
      - postgres
      - redis

  celery-beat:
    build: ./apps/worker
    command: python beat.py
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
      - redis

  flower:
    build: ./apps/worker
    command: python flower.py
    ports:
      - "5555:5555"
    environment:
      - CELERY_BROKER_URL=${REDIS_URL}
    depends_on:
      - redis
```

### Monitoring Stack

Integrate with existing observability:

- **Prometheus**: Scrape metrics from `:8000/metrics`
- **Grafana**: Dashboards for worker metrics
- **Jaeger**: Distributed tracing (if configured)
- **Alertmanager**: Alert on worker failures

## Troubleshooting

### Common Issues

1. **Worker won't start**: Check Redis connectivity
2. **Tasks failing**: Check database circuit breaker status
3. **dbt failures**: Verify dbt project configuration
4. **Alerts not sending**: Check SMTP/webhook settings

### Health Checks

```bash
# Check all services
./workerctl.sh status

# Check database connectivity
python -c "from apps.worker.utils.database import test_database_connection; print(test_database_connection())"

# Check Redis connectivity
python -c "import redis; r=redis.from_url('redis://localhost:6379/0'); print(r.ping())"
```

### Logs Analysis

```bash
# View worker logs
tail -f logs/worker-analytics.log

# Search for errors
grep ERROR logs/*.log

# Monitor task execution
grep "Task completed" logs/worker-*.log
```

## Security

### Authentication

- Flower: Basic authentication (admin:admin - change in production)
- API: JWT tokens for service communication
- Database: Use connection strings with secure passwords

### Network Security

- Redis: Use AUTH and TLS in production
- Database: Use SSL connections
- Webhooks: Verify HTTPS endpoints

### Secrets Management

- Use environment variables for sensitive data
- Rotate API keys and passwords regularly
- Use secret management services in production

## Performance

### Optimization

- Tune concurrency limits based on resources
- Use connection pooling for database
- Optimize dbt model dependencies
- Monitor and adjust retry policies

### Scaling

- Horizontal scaling: Multiple worker instances
- Queue-based scaling: Separate queues by priority
- Database scaling: Read replicas for analytics queries
- Cache optimization: Redis for frequently accessed data

## Support

For issues and questions:

1. Check logs for error details
2. Review task registry documentation
3. Verify environment configuration
4. Check service health status
5. Review monitoring metrics

## License

This Celery worker implementation is part of the BI-Agent analytics platform.
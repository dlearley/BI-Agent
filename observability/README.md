# Observability Stack

This directory contains the observability configuration for the BI-Agent Analytics platform, including distributed tracing, metrics collection, and visualization dashboards.

## Components

### OpenTelemetry Collector
- **Port**: 4317 (gRPC), 4318 (HTTP)
- **Purpose**: Collects traces and metrics from the application and exports them to Jaeger and Prometheus
- **Configuration**: `otel-collector-config.yml`

### Jaeger
- **UI Port**: 16686
- **Purpose**: Distributed tracing visualization
- **Access**: http://localhost:16686

### Prometheus
- **Port**: 9090
- **Purpose**: Metrics storage and querying
- **Configuration**: `prometheus.yml`
- **Access**: http://localhost:9090

### Grafana
- **Port**: 3001
- **Purpose**: Metrics visualization and dashboards
- **Credentials**: admin/admin
- **Access**: http://localhost:3001

## Quick Start

### Start with Docker Compose

From the `analytics-service` directory:

```bash
docker-compose up -d
```

This will start:
- Analytics service
- PostgreSQL
- Redis
- OpenTelemetry Collector
- Jaeger
- Prometheus
- Grafana

### Accessing the Stack

- **Application**: http://localhost:3000
- **Metrics Endpoint**: http://localhost:3000/metrics
- **Health Check**: http://localhost:3000/health
- **Jaeger UI**: http://localhost:16686
- **Prometheus UI**: http://localhost:9090
- **Grafana UI**: http://localhost:3001 (admin/admin)

## Dashboards

Three pre-configured Grafana dashboards are available:

### 1. API Latency Dashboard
- API response time percentiles (P50, P95, P99)
- Request rate by route
- Error rate monitoring
- HTTP method distribution

### 2. Task Throughput Dashboard
- Job processing throughput
- Failed job rate
- Job duration metrics
- Queue size monitoring
- Current failed/delayed job counts

### 3. Database Performance Dashboard
- Database query duration (P50, P95, P99)
- Query rate by operation
- Redis operation performance
- Cache hit/miss rates
- Analytics refresh metrics

## Metrics Exposed

### HTTP Metrics
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - HTTP request duration histogram

### Database Metrics
- `db_query_duration_seconds` - Database query duration histogram
- `redis_operation_duration_seconds` - Redis operation duration histogram

### Cache Metrics
- `cache_hits_total` - Total cache hits
- `cache_misses_total` - Total cache misses

### Queue Metrics
- `queue_jobs_total` - Total jobs processed
- `queue_job_duration_seconds` - Job processing duration
- `queue_size` - Current queue size by state

### Analytics Metrics
- `analytics_refresh_total` - Total analytics refreshes
- `analytics_refresh_duration_seconds` - Refresh duration
- `analytics_query_total` - Total analytics queries

### HIPAA Audit Metrics
- `hipaa_audit_events_total` - Total HIPAA audit events

## Structured Logging

The application uses structured JSON logging with correlation IDs for request tracing:

```json
{
  "timestamp": "2024-01-15 12:00:00",
  "level": "info",
  "message": "HTTP request completed",
  "method": "GET",
  "url": "/api/v1/analytics/pipeline",
  "status": 200,
  "duration": "0.125",
  "correlationId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
  "spanId": "00f067aa0ba902b7",
  "service": "analytics-service"
}
```

### Correlation IDs

Every request is assigned a correlation ID (via `x-request-id` header) that:
- Propagates through the entire request lifecycle
- Links logs to traces
- Enables end-to-end request tracking
- Can be provided by clients or auto-generated

### Audit Logging

HIPAA-compliant audit logs are stored separately in `logs/audit.log`:

```json
{
  "timestamp": "2024-01-15 12:00:00",
  "level": "info",
  "message": "Audit event",
  "action": "VIEW_ANALYTICS",
  "userId": "user-123",
  "resource": "/api/v1/analytics/pipeline",
  "audit": true,
  "traceId": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

## Environment Variables

### OpenTelemetry Configuration
- `OTEL_SERVICE_NAME` - Service name for telemetry (default: `analytics-service`)
- `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP collector endpoint (default: `http://localhost:4318`)
- `LOG_LEVEL` - Logging level (default: `info`)

## Querying Metrics

### Prometheus Query Examples

**API Latency P95**:
```promql
histogram_quantile(0.95, sum(rate(http_request_duration_seconds_bucket[5m])) by (route, le))
```

**Error Rate**:
```promql
sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m]))
```

**Cache Hit Rate**:
```promql
sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))
```

**Queue Processing Rate**:
```promql
sum(rate(queue_jobs_total{status="completed"}[5m])) by (queue, job_type)
```

## Tracing

### Viewing Traces in Jaeger

1. Open Jaeger UI at http://localhost:16686
2. Select `analytics-service` from the service dropdown
3. Choose an operation (e.g., `GET /api/v1/analytics/pipeline`)
4. Click "Find Traces"
5. Click on a trace to see detailed span information

### Trace Context

Traces automatically include:
- HTTP request/response details
- Database query information
- Redis operations
- Queue job processing
- Error information
- Custom span attributes

## Troubleshooting

### Collector Not Receiving Data

Check the collector health:
```bash
curl http://localhost:13133
```

### Missing Metrics in Prometheus

Verify Prometheus is scraping the analytics service:
```bash
curl http://localhost:9090/api/v1/targets
```

### No Traces in Jaeger

Check OTLP endpoint connectivity:
```bash
docker logs analytics-otel-collector
```

### Grafana Dashboard Issues

Verify datasources are configured:
1. Go to Configuration > Data Sources in Grafana
2. Ensure Prometheus and Jaeger are listed and working

## Production Considerations

### Security
- Change Grafana admin password
- Enable authentication for Prometheus
- Use TLS for all endpoints
- Implement proper network segmentation

### Performance
- Adjust sampling rates for high-traffic scenarios
- Configure metric retention policies
- Set appropriate cardinality limits

### Storage
- Configure persistent storage for Prometheus data
- Implement log rotation policies
- Set up backup strategies for Grafana dashboards

### Monitoring
- Alert on collector health
- Monitor metric scraping failures
- Track trace sampling rates
- Set up alerting for error rates and latency

## Additional Resources

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)

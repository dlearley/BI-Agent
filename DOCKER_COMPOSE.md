# Docker Compose Stack Documentation

This document provides comprehensive documentation for the orchestrated Docker Compose stack that brings up the entire BI-Agent analytics platform with all required services.

## Overview

The Docker Compose stack orchestrates the following services:

| Service | Port | Purpose |
|---------|------|---------|
| **postgres** | 5432 | PostgreSQL 15 with pgvector extension |
| **redis** | 6379 | Redis cache store |
| **minio** | 9000/9001 | S3-compatible object storage |
| **analytics-api** | 3000 | Node.js/Express analytics API |
| **ml-service** | 8000 | FastAPI machine learning service |
| **web** | 3001 | Next.js web frontend |
| **celery-worker** | N/A | Celery background task worker |
| **celery-beat** | N/A | Celery scheduled task scheduler |
| **otel-collector** | 4317/4318 | OpenTelemetry collector |
| **jaeger** | 16686 | Distributed tracing UI |
| **prometheus** | 9090 | Metrics collection and querying |
| **grafana** | 3002 | Metrics visualization and dashboards |

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 1.29+)
- At least 4GB RAM available
- ~10GB disk space for volumes

## Quick Start

### 1. Setup Local Environment

```bash
# Navigate to project root
cd /path/to/bi-agent

# Run setup script
./scripts/setup-local-env.sh

# This script will:
# - Create .env file from .env.example
# - Create necessary directories
# - Verify Docker installation
# - Make scripts executable
```

### 2. Configure Environment Variables

Edit `.env` file with your configuration:

```bash
# Database
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=analytics_db

# Redis
REDIS_PASSWORD=

# MinIO
MINIO_ROOT_USER=minioadmin
MINIO_ROOT_PASSWORD=minioadmin

# API
JWT_SECRET=your-secret-key-change-in-production

# Observability
GRAFANA_USER=admin
GRAFANA_PASSWORD=admin
```

### 3. Start Services

```bash
# Start all services in background
docker-compose up -d

# View logs
docker-compose logs -f

# Check service health
./scripts/health-check.sh
```

### 4. Access Services

Once all services are healthy, access them via:

- **Analytics API**: http://localhost:3000
  - Health: http://localhost:3000/health
  
- **Web UI**: http://localhost:3001

- **ML Service**: http://localhost:8000
  - API Docs: http://localhost:8000/docs

- **MinIO Console**: http://localhost:9001
  - Username: `minioadmin`
  - Password: `minioadmin`

- **Grafana**: http://localhost:3002
  - Username: `admin`
  - Password: `admin`

- **Jaeger UI**: http://localhost:16686

- **Prometheus**: http://localhost:9090

## Service Details

### PostgreSQL (postgres)

- **Image**: postgres:15-alpine
- **Port**: 5432
- **Features**:
  - UUID support
  - JSON support
  - pgvector extension (for embeddings)
  - Analytics schema pre-configured

**Database Access**:
```bash
docker-compose exec postgres psql -U postgres -d analytics_db

# Or using local psql
psql -h localhost -U postgres -d analytics_db
```

**Backup Database**:
```bash
docker-compose exec postgres pg_dump -U postgres analytics_db > backup.sql
```

**Restore Database**:
```bash
docker-compose exec -T postgres psql -U postgres analytics_db < backup.sql
```

### Redis (redis)

- **Image**: redis:7-alpine
- **Port**: 6379
- **Features**:
  - Persistence enabled (AOF)
  - Used for caching and Celery broker

**Monitor Redis**:
```bash
docker-compose exec redis redis-cli

# View stats
> info stats

# Monitor commands
> monitor

# View keys
> keys *
```

### MinIO (minio)

- **Image**: minio/minio:latest
- **Ports**: 9000 (API), 9001 (Console)
- **Features**:
  - S3-compatible storage
  - Web console for file management
  - Pre-configured buckets: models, datasets, logs

**Access Console**:
- Navigate to http://localhost:9001
- Login with `minioadmin`/`minioadmin`

**Create Bucket from CLI**:
```bash
docker-compose exec minio mc mb minio/my-bucket
```

### Analytics API (analytics-api)

- **Language**: Node.js/TypeScript
- **Framework**: Express.js
- **Port**: 3000
- **Features**:
  - RBAC (Role-Based Access Control)
  - HIPAA compliance mode
  - OpenTelemetry instrumentation
  - Redis caching

**API Documentation**:
```bash
# Health check
curl http://localhost:3000/health

# Analytics endpoints
curl -H "Authorization: Bearer YOUR_JWT" \
  http://localhost:3000/api/v1/analytics/kpis
```

**View Logs**:
```bash
docker-compose logs -f analytics-api
```

### ML Service (ml-service)

- **Language**: Python
- **Framework**: FastAPI
- **Port**: 8000
- **Features**:
  - Model training and inference
  - Integration with PostgreSQL and Redis
  - OpenTelemetry instrumentation

**API Documentation**:
```bash
# Interactive API docs
# http://localhost:8000/docs

# Health check
curl http://localhost:8000/health

# Make predictions
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"data": [1, 2, 3], "model_type": "forecast"}'
```

**View Logs**:
```bash
docker-compose logs -f ml-service
```

### Web Frontend (web)

- **Language**: TypeScript/React
- **Framework**: Next.js
- **Port**: 3001
- **Features**:
  - Server-side rendering
  - Connected to Analytics API and ML Service

**View Logs**:
```bash
docker-compose logs -f web
```

### Celery Services

#### Worker (celery-worker)
- Background task processing
- Connects to Redis broker
- Executes analytics, ML, and data tasks

#### Beat (celery-beat)
- Scheduled task execution
- Cron-like scheduling
- Persists schedules in database

**Monitor Tasks**:
```bash
# View active tasks
docker-compose exec celery-worker celery -A tasks inspect active

# View registered tasks
docker-compose exec celery-worker celery -A tasks inspect registered

# Flower (task monitoring)
docker-compose run --rm celery-worker \
  celery -A tasks events --camera flower.events.EventSnapshot
```

**View Logs**:
```bash
docker-compose logs -f celery-worker celery-beat
```

### Observability Stack

#### OpenTelemetry Collector (otel-collector)
- **Ports**: 4317 (gRPC), 4318 (HTTP)
- Collects traces, metrics, and logs
- Routes to Jaeger and Prometheus

#### Jaeger (jaeger)
- **Port**: 16686 (UI)
- Distributed tracing
- Trace visualization and analysis

**Access**:
- http://localhost:16686

#### Prometheus (prometheus)
- **Port**: 9090
- Metrics collection
- Time-series database

**Metrics**:
- Access http://localhost:9090
- Query metrics: `up`, `rate(requests_total[5m])`, etc.

#### Grafana (grafana)
- **Port**: 3002
- Metrics visualization
- Pre-configured dashboards

**Login**:
- Username: `admin`
- Password: `admin`

**Add Prometheus Datasource**:
1. Settings → Data Sources
2. Add new → Prometheus
3. URL: `http://prometheus:9090`

## Common Tasks

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f analytics-api

# Last 100 lines, specific service
docker-compose logs --tail 100 ml-service
```

### Stop Services

```bash
# Stop all services (keep volumes)
docker-compose stop

# Stop specific service
docker-compose stop analytics-api

# Remove stopped containers
docker-compose rm
```

### Restart Services

```bash
# Restart all services
docker-compose restart

# Restart specific service
docker-compose restart postgres
```

### Clean Up

```bash
# Remove containers and volumes (WARNING: deletes data)
docker-compose down -v

# Remove only containers (keep volumes)
docker-compose down

# Remove unused images
docker image prune
```

### Database Operations

```bash
# Create backup
docker-compose exec postgres pg_dump -U postgres analytics_db > backup.sql

# Restore from backup
docker-compose exec -T postgres psql -U postgres analytics_db < backup.sql

# Connect to database
docker-compose exec postgres psql -U postgres -d analytics_db

# Run migrations
docker-compose exec analytics-api npm run migrate

# Seed sample data
docker-compose exec analytics-api npm run seed
```

### Build Custom Images

```bash
# Rebuild all images
docker-compose build

# Rebuild specific service
docker-compose build ml-service

# Build without cache
docker-compose build --no-cache
```

### Run Commands in Services

```bash
# Execute command in service
docker-compose exec analytics-api npm run build

# Run one-off command
docker-compose run --rm ml-service python -c "import fastapi; print(fastapi.__version__)"

# Interactive shell
docker-compose exec postgres bash
```

## Networking

The stack creates two networks:

### local-dev
- Internal communication between services
- Services: postgres, redis, minio, analytics-api, ml-service, web, celery-worker, celery-beat

### observability
- Observability services communication
- Services: otel-collector, jaeger, prometheus, grafana, and all application services

**Inter-service Communication**:
```
analytics-api → postgres: postgresql://postgres:5432/analytics_db
analytics-api → redis: redis://redis:6379
ml-service → minio: minio:9000
celery-worker → redis: redis://redis:6379
```

## Volume Management

### Persistent Volumes

- **postgres_data**: PostgreSQL database files
- **redis_data**: Redis persistence
- **minio_data**: MinIO object storage
- **prometheus_data**: Prometheus time-series data
- **grafana_data**: Grafana configuration and dashboards

### Service Volumes

- **analytics-service/logs**: Application logs
- **ml-service/logs**: ML service logs
- **celery-service/logs**: Celery task logs

**Inspect Volume**:
```bash
docker volume inspect project_postgres_data
```

**Clean Volume**:
```bash
docker volume rm project_postgres_data
```

## Troubleshooting

### Service Won't Start

```bash
# Check logs
docker-compose logs service_name

# Verify configuration
docker-compose config

# Restart service
docker-compose restart service_name
```

### Connection Refused

```bash
# Check if service is running
docker-compose ps

# Check network connectivity
docker-compose exec analytics-api ping postgres
```

### Database Errors

```bash
# Check PostgreSQL logs
docker-compose logs postgres

# Connect and verify
docker-compose exec postgres psql -U postgres -c "\l"
```

### High Memory Usage

```bash
# Check resource usage
docker stats

# Limit service resources by editing docker-compose.yml
# Add to service:
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process or change port in .env
PORT=3001
```

## Performance Optimization

### Resource Limits

Add to service definition:
```yaml
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
    reservations:
      cpus: '0.5'
      memory: 256M
```

### Database Optimization

```bash
# Analyze query performance
docker-compose exec postgres psql -U postgres -d analytics_db -c "EXPLAIN ANALYZE SELECT ..."

# Vacuum and analyze
docker-compose exec postgres vacuumdb -U postgres -d analytics_db -az
```

### Cache Configuration

Edit Redis configuration:
```bash
# Increase max memory
--maxmemory 512mb --maxmemory-policy allkeys-lru
```

## Production Considerations

1. **Secrets Management**: Use Docker secrets or environment variable vaults
2. **Resource Limits**: Set appropriate CPU and memory limits
3. **Backup Strategy**: Implement automated database backups
4. **Monitoring**: Configure alerting for critical services
5. **Logging**: Send logs to external service (ELK, Datadog, etc.)
6. **SSL/TLS**: Use reverse proxy (nginx) for HTTPS
7. **Updates**: Plan update strategy for service images

## Further Reading

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Celery Documentation](https://docs.celeryproject.io/)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)

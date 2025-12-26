# Deployment Guide

This guide covers deploying the BI-Agent analytics platform using Docker Compose in local development and production environments.

## Table of Contents

1. [Local Development](#local-development)
2. [Testing the Stack](#testing-the-stack)
3. [Service Health Verification](#service-health-verification)
4. [Monitoring and Logging](#monitoring-and-logging)
5. [Common Issues](#common-issues)
6. [Acceptance Criteria](#acceptance-criteria)

## Local Development

### Initial Setup

```bash
# Navigate to project directory
cd /path/to/bi-agent

# Run setup script to initialize environment
./scripts/setup-local-env.sh

# Review and configure .env file
cat .env

# Start all services
docker-compose up -d

# Verify all services are healthy
./scripts/health-check.sh
```

### Service Startup Order

The Docker Compose configuration uses dependency management to ensure proper startup order:

1. **postgres** - PostgreSQL database
2. **redis** - Redis cache
3. **minio** - Object storage
4. **otel-collector** → **jaeger** → **prometheus** → **grafana** (Observability stack)
5. **analytics-api** (depends on postgres, redis, otel-collector)
6. **ml-service** (depends on postgres, redis, minio)
7. **web** (depends on analytics-api)
8. **celery-worker** and **celery-beat** (depend on postgres, redis, minio)

### Environment Configuration

Key environment variables in `.env`:

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

# Analytics API
JWT_SECRET=your-super-secret-key

# Observability
GRAFANA_PASSWORD=admin
LOG_LEVEL=info
```

## Testing the Stack

### 1. Database Connectivity

```bash
# Test PostgreSQL connection
docker-compose exec postgres psql -U postgres -c "SELECT version();"

# Check for pgvector extension
docker-compose exec postgres psql -U postgres -d analytics_db -c "\dx"

# Check analytics schema
docker-compose exec postgres psql -U postgres -d analytics_db -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'analytics';"
```

### 2. Cache Verification

```bash
# Test Redis connection
docker-compose exec redis redis-cli ping

# Check Redis info
docker-compose exec redis redis-cli info stats

# Monitor Redis keys
docker-compose exec redis redis-cli keys '*'
```

### 3. Object Storage

```bash
# Check MinIO health
curl -f http://localhost:9000/minio/health/live

# Verify buckets via console
# http://localhost:9001 (minioadmin/minioadmin)
```

### 4. Analytics API

```bash
# Health check
curl http://localhost:3000/health

# Response should be:
# {"status":"healthy","timestamp":"..."}

# Check API version
curl http://localhost:3000/api/v1/health
```

### 5. ML Service

```bash
# Health check
curl http://localhost:8000/health

# List available models
curl http://localhost:8000/models

# API documentation
# http://localhost:8000/docs
```

### 6. Web Frontend

```bash
# Check if running
curl -s http://localhost:3001 | head -20

# Access web UI
# http://localhost:3001
```

### 7. Observability Stack

#### Prometheus
```bash
# Verify Prometheus is scraping targets
# http://localhost:9090/targets

# Query metrics
curl 'http://localhost:9090/api/v1/query?query=up'
```

#### Grafana
```bash
# Login and verify datasources
# http://localhost:3002
# Username: admin
# Password: admin

# Check if Prometheus datasource is configured
# Settings → Data Sources → Prometheus
```

#### Jaeger
```bash
# Access Jaeger UI
# http://localhost:16686

# Should see traces from analytics-api, ml-service, etc.
```

#### OpenTelemetry Collector
```bash
# Check collector health
docker-compose logs otel-collector | grep -i "health\|ready"
```

### 8. Celery Background Jobs

```bash
# Check registered tasks
docker-compose exec celery-worker celery -A tasks inspect registered

# View active tasks
docker-compose exec celery-worker celery -A tasks inspect active

# Monitor with Flower (optional)
docker-compose exec celery-worker celery -A tasks events --camera flower.events.EventSnapshot
```

## Service Health Verification

Run the provided health check script:

```bash
./scripts/health-check.sh
```

Expected output:
```
Checking PostgreSQL on port 5432... ✓ Running
Checking Redis on port 6379... ✓ Running
Checking MinIO on port 9000... ✓ Running
Checking Analytics API on port 3000... ✓ Running
Checking Web UI on port 3001... ✓ Running
Checking ML Service on port 8000... ✓ Running
Checking Prometheus on port 9090... ✓ Running
Checking Grafana on port 3002... ✓ Running
Checking Jaeger on port 16686... ✓ Running
Checking OTel Collector on port 4318... ✓ Running

All services are healthy!
```

## Monitoring and Logging

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f analytics-api

# Last 100 lines
docker-compose logs --tail 100 ml-service

# Interactive log viewer
./scripts/view-logs.sh
```

### Monitor Resource Usage

```bash
# Real-time resource stats
docker stats

# Specific container
docker stats analytics-api
```

### Check Container Status

```bash
# List all containers
docker-compose ps

# Inspect specific container
docker-compose ps analytics-api
```

### Database Logs

```bash
# PostgreSQL logs
docker-compose logs postgres

# Check for errors
docker-compose logs postgres | grep -i error
```

### Application Metrics

```bash
# Prometheus targets
curl http://localhost:9090/api/v1/targets | jq '.data.activeTargets'

# Current metrics
curl 'http://localhost:9090/api/v1/query?query=rate(http_requests_total[5m])'
```

## Common Issues

### Service Won't Start

```bash
# Check logs
docker-compose logs service_name

# Verify configuration
docker-compose config

# Restart service
docker-compose restart service_name
```

### Port Already in Use

```bash
# Find process using port
lsof -i :3000

# Kill process or change port in .env
PORT=3000
docker-compose up -d
```

### Out of Memory

```bash
# Check Docker resource limits
docker stats

# Increase Docker desktop memory limit and restart
# Or add limits to services in docker-compose.yml:
# deploy:
#   resources:
#     limits:
#       memory: 512M
```

### Database Connection Refused

```bash
# Check if postgres is running
docker-compose ps postgres

# Check postgres logs
docker-compose logs postgres

# Verify credentials in .env
grep DB_ .env

# Try manual connection
docker-compose exec postgres psql -U postgres
```

### API Not Responding

```bash
# Check API container status
docker-compose ps analytics-api

# Check API logs
docker-compose logs analytics-api

# Verify API is listening
docker-compose exec analytics-api netstat -tlnp | grep 3000
```

### pgvector Extension Missing

```bash
# Check available extensions
docker-compose exec postgres psql -U postgres -d analytics_db -c "\dx"

# Run initialization script
docker-compose exec postgres psql -U postgres -d analytics_db < scripts/init-pgvector.sql

# Note: pgvector requires compilation from source in postgres image
# Consider using custom postgres image with pgvector pre-installed
```

## Acceptance Criteria

The Docker Compose stack meets all acceptance criteria when:

### ✓ Services Are Healthy

- [ ] `docker-compose up` starts all services successfully
- [ ] `docker-compose ps` shows all containers running
- [ ] `./scripts/health-check.sh` passes all checks

### ✓ API Accessibility

- [ ] Analytics API responds to health checks: `curl http://localhost:3000/health`
- [ ] Web UI is accessible: `curl http://localhost:3001`
- [ ] ML Service responds to health checks: `curl http://localhost:8000/health`

### ✓ PostgreSQL Configuration

- [ ] PostgreSQL is running and accessible
- [ ] Analytics database exists and is accessible
- [ ] UUID support is enabled: `SELECT uuid_generate_v4()`
- [ ] JSON support is enabled: `SELECT json_array_length('[1,2,3]'::json)`
- [ ] Analytics schema is created: `SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'analytics'`
- [ ] pgvector extension is available (or init script completes successfully)

### ✓ Redis Configuration

- [ ] Redis is running and accessible
- [ ] Redis ping responds: `docker-compose exec redis redis-cli ping`
- [ ] Persistence is enabled: `docker-compose exec redis redis-cli config get appendonly`

### ✓ MinIO Configuration

- [ ] MinIO console is accessible: http://localhost:9001
- [ ] MinIO health check passes: `curl -f http://localhost:9000/minio/health/live`
- [ ] Default buckets are created or can be created

### ✓ Observability Stack

- [ ] Prometheus is accessible: http://localhost:9090
- [ ] Grafana is accessible: http://localhost:3002 (admin/admin)
- [ ] Jaeger UI is accessible: http://localhost:16686
- [ ] OTel Collector is running: `docker-compose logs otel-collector | grep "ready"`
- [ ] Traces appear in Jaeger for service calls

### ✓ Background Jobs

- [ ] Celery worker is running: `docker-compose ps celery-worker`
- [ ] Celery beat is running: `docker-compose ps celery-beat`
- [ ] Tasks are registered: `docker-compose exec celery-worker celery -A tasks inspect registered`

### ✓ Documentation

- [ ] README.md includes Docker Compose instructions
- [ ] DOCKER_COMPOSE.md provides detailed documentation
- [ ] DEPLOYMENT.md provides deployment guidance
- [ ] .env.example includes all required variables

### Quick Verification Script

```bash
#!/bin/bash
echo "Verifying acceptance criteria..."

# Services running
echo -n "Services running... "
[ $(docker-compose ps -q | wc -l) -eq 12 ] && echo "✓" || echo "✗"

# API health
echo -n "Analytics API health... "
curl -s http://localhost:3000/health > /dev/null && echo "✓" || echo "✗"

# Database connection
echo -n "PostgreSQL connection... "
docker-compose exec -T postgres psql -U postgres -c "SELECT 1;" > /dev/null 2>&1 && echo "✓" || echo "✗"

# Redis connection
echo -n "Redis connection... "
docker-compose exec -T redis redis-cli ping > /dev/null 2>&1 && echo "✓" || echo "✗"

# Grafana access
echo -n "Grafana accessible... "
curl -s http://localhost:3002/login > /dev/null && echo "✓" || echo "✗"

# Jaeger access
echo -n "Jaeger accessible... "
curl -s http://localhost:16686 > /dev/null && echo "✓" || echo "✗"

# Prometheus access
echo -n "Prometheus accessible... "
curl -s http://localhost:9090 > /dev/null && echo "✓" || echo "✗"

echo "Verification complete!"
```

## Production Deployment

For production deployment, consider:

1. **Secrets Management**: Use Docker secrets or environment variable vaults
2. **Backup Strategy**: Implement automated PostgreSQL backups
3. **Monitoring**: Configure alerts for service failures
4. **Logging**: Send logs to centralized logging service
5. **Scaling**: Use Kubernetes or Docker Swarm for multi-node deployment
6. **SSL/TLS**: Use reverse proxy (nginx) for HTTPS
7. **Resource Limits**: Set appropriate CPU and memory limits per service
8. **Health Checks**: Configure aggressive health checks and auto-restart
9. **Update Strategy**: Plan and test update procedures
10. **Disaster Recovery**: Document and test recovery procedures

See [DOCKER_COMPOSE.md](DOCKER_COMPOSE.md) for additional deployment options.

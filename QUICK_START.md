# Quick Start Guide

Get the entire BI-Agent analytics platform running locally in minutes.

## Prerequisites

- Docker (version 20.10+)
- Docker Compose (version 1.29+)
- 4GB RAM available
- ~10GB free disk space

## 5-Minute Setup

### 1. Initialize Environment (1 minute)

```bash
cd /path/to/bi-agent
./scripts/setup-local-env.sh
```

This script will:
- Create `.env` from `.env.example`
- Verify Docker is installed and running
- Create necessary directories
- Make scripts executable

### 2. Start Services (2-3 minutes)

```bash
docker-compose up -d
```

Services will start in dependency order. Wait for all containers to show "Up".

### 3. Verify Health (1 minute)

```bash
./scripts/health-check.sh
```

Expected output: "All services are healthy!" with green checkmarks.

## Access Services

| Service | URL | Purpose |
|---------|-----|---------|
| **Web UI** | http://localhost:3001 | Dashboard |
| **Analytics API** | http://localhost:3000 | REST API |
| **ML Service** | http://localhost:8000 | Predictions |
| **Grafana** | http://localhost:3002 | Dashboards (admin/admin) |
| **Jaeger** | http://localhost:16686 | Tracing |
| **Prometheus** | http://localhost:9090 | Metrics |
| **MinIO** | http://localhost:9001 | Storage (minioadmin/minioadmin) |

## Common Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f analytics-api

# Interactive selection
./scripts/view-logs.sh
```

### Stop Services

```bash
docker-compose stop
```

### Restart Services

```bash
docker-compose restart
```

### Clean Up

```bash
# Remove containers (keep data)
docker-compose down

# Remove everything including data
docker-compose down -v
./scripts/cleanup.sh
```

### Database Access

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d analytics_db

# Backup database
docker-compose exec postgres pg_dump -U postgres analytics_db > backup.sql

# Restore database
docker-compose exec -T postgres psql -U postgres analytics_db < backup.sql
```

### Redis Operations

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Monitor keys
docker-compose exec redis redis-cli keys '*'

# Check stats
docker-compose exec redis redis-cli info stats
```

## Testing API

### Health Check

```bash
curl http://localhost:3000/health
```

### Make Prediction (ML Service)

```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"data": [1, 2, 3], "model_type": "forecast"}'
```

### Query Metrics (Prometheus)

```bash
curl 'http://localhost:9090/api/v1/query?query=up'
```

## Configuration

Edit `.env` to customize:

```bash
# Database
DB_USER=postgres
DB_PASSWORD=postgres

# API
JWT_SECRET=your-secret-key

# Observability
GRAFANA_PASSWORD=admin

# Application
LOG_LEVEL=info
```

Then restart services:

```bash
docker-compose restart
```

## Troubleshooting

### Service won't start?

```bash
docker-compose logs service_name
```

### Port already in use?

```bash
lsof -i :3000  # Find process using port
# Then either:
# 1. Kill the process: kill -9 <PID>
# 2. Change port in .env and restart
```

### Out of memory?

```bash
docker stats  # Check resource usage
# Increase Docker desktop memory limit
```

### Container exiting immediately?

```bash
docker-compose logs analytics-api
# Check for error messages
```

## Documentation

For detailed information, see:

- **[DOCKER_COMPOSE.md](DOCKER_COMPOSE.md)** - Comprehensive Docker Compose guide
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment and testing procedures
- **[INFRASTRUCTURE_STACK.md](INFRASTRUCTURE_STACK.md)** - Architecture details
- **[README.md](README.md)** - Full project documentation

## Next Steps

1. ✅ Run `./scripts/setup-local-env.sh`
2. ✅ Run `docker-compose up -d`
3. ✅ Run `./scripts/health-check.sh`
4. 🔗 Access http://localhost:3001
5. 📚 Read documentation files
6. 🚀 Start developing!

## Support

- Check logs: `docker-compose logs -f`
- See [Troubleshooting](DEPLOYMENT.md#troubleshooting)
- Review [DOCKER_COMPOSE.md](DOCKER_COMPOSE.md) for detailed docs

---

**Stuck?** Run these commands in order:
```bash
docker-compose down -v        # Stop and clean
./scripts/setup-local-env.sh  # Re-initialize
docker-compose up -d          # Start again
./scripts/health-check.sh     # Verify
```

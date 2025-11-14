# BI-Agent - Analytics and Business Intelligence Platform

A comprehensive analytics and business intelligence platform migrated from NurseHR's analytics backend. This platform provides healthcare recruitment and compliance metrics with HIPAA compliance features.

## Migration Origin

This repository contains the full analytics/business intelligence stack that was originally developed in the NurseHR repository's `feature/analytics-backend-views-api-rbac-hipaa-refresh-dbt-redis` branch. The migration preserves all git history and functionality while organizing the code for independent deployment as BI-Agent.

## Project Structure

```
bi-agent/
├── analytics-service/     # Main analytics API service (Node.js/Express)
│   ├── src/              # TypeScript source code
│   ├── package.json      # Service dependencies
│   ├── Dockerfile        # Container configuration
│   ├── docker-compose.yml # Service composition (analytics only)
│   └── logs/             # Application logs
├── ml-service/           # ML Service (FastAPI/Python)
│   ├── main.py           # FastAPI application
│   ├── Dockerfile        # Container configuration
│   ├── requirements.txt   # Python dependencies
│   └── logs/             # Service logs
├── web/                  # Web Frontend (Next.js/React)
│   ├── pages/            # Next.js pages
│   ├── Dockerfile        # Container configuration
│   ├── package.json      # Dependencies
│   └── next.config.js    # Next.js configuration
├── celery-service/       # Background Jobs (Python/Celery)
│   ├── tasks.py          # Task definitions
│   ├── config.py         # Celery configuration
│   ├── Dockerfile        # Container configuration
│   ├── requirements.txt   # Python dependencies
│   └── logs/             # Task logs
├── dbt/                  # dbt Analytics Project
│   ├── models/           # Analytics models
│   ├── macros/           # Custom dbt macros
│   └── dbt_project.yml   # dbt configuration
├── observability/        # Observability Stack Configuration
│   ├── otel-collector-config.yml  # OpenTelemetry configuration
│   ├── prometheus.yml    # Prometheus configuration
│   └── grafana/          # Grafana dashboards and provisioning
├── jobs/                 # Background Jobs and Setup Scripts
│   ├── refresh/          # SQL refresh scripts
│   └── setup.sh          # Environment setup
├── scripts/              # Utility Scripts
│   ├── setup-local-env.sh    # Local environment setup
│   ├── health-check.sh       # Service health verification
│   ├── bootstrap-db.sh       # Database bootstrap
│   └── init-pgvector.sql     # pgvector initialization
├── docker-compose.yml    # Complete stack orchestration
├── .env.example          # Environment configuration template
├── DOCKER_COMPOSE.md     # Docker Compose documentation
├── package.json          # Workspace configuration
└── README.md             # This file
```

## Features

- **PostgreSQL 15 Analytics**: Materialized views and standard views for KPI calculations with pgvector
- **REST API**: Express.js API with role-based access control (RBAC)
- **ML Service**: FastAPI-based machine learning service for predictions and model training
- **Web Frontend**: Next.js web interface for dashboard and analytics visualization
- **Background Jobs**: Celery workers and scheduler for async task processing
- **S3-Compatible Storage**: MinIO for storing models, datasets, and logs
- **Redis Caching**: Intelligent caching for improved performance
- **BullMQ Jobs**: Scheduled and manual refresh strategies
- **HIPAA Compliance**: PII redaction and minimum threshold enforcement
- **OpenTelemetry Observability**: Tracing, metrics, and dashboards with Jaeger, Prometheus, and Grafana
- **dbt Integration**: Transformations with dbt for analytics engineering
- **TypeScript**: Full type safety throughout the application
- **Docker Compose Orchestration**: Complete stack with all services in one command

## Architecture

### Core Components

1. **Analytics Service** (`analytics-service/`): Main API service for analytics endpoints (Node.js/Express)
2. **ML Service** (`ml-service/`): Machine learning service for predictions and training (FastAPI)
3. **Web Frontend** (`web/`): User interface for dashboards and analytics (Next.js)
4. **Database Layer**: PostgreSQL 15 with pgvector for vector embeddings and materialized views for KPIs
5. **Cache Layer**: Redis for performance optimization and job queue
6. **Object Storage**: MinIO for S3-compatible storage of models, datasets, and logs
7. **Background Jobs**: Celery workers and beat scheduler for async task processing
8. **Analytics Engine**: dbt for data transformations
9. **Refresh Jobs**: Automated and manual data refresh strategies
10. **Observability Stack**: OpenTelemetry collector, Jaeger for tracing, Prometheus for metrics, and Grafana for visualization

### KPIs Provided

- **Pipeline Metrics**: Application counts, time-to-fill, conversion rates
- **Compliance Metrics**: Compliance scores, violation tracking
- **Revenue Metrics**: Revenue per placement, facility revenue breakdown
- **Outreach Effectiveness**: Response rates, conversion by channel

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12+
- Redis 6+
- npm or pnpm
- (Optional) dbt Core for analytics transformations

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd bi-agent

# Install dependencies
npm install

# Copy environment configuration
cp analytics-service/.env.example analytics-service/.env

# Edit .env with your database and Redis credentials
```

### Seed Demo Data

```bash
# Seed database with demo organization and ecommerce data
npm run seed

# This will create:
# - Demo Ecommerce organization
# - 3 data connectors
# - 5 saved queries
# - 3 dashboards (Marketing, Sales, Finance)
# - 2 alerts
# - 1 weekly report template
# - Sample ecommerce data (customers, products, orders)
# - Celery-style schedules for alerts and reports
```

### Environment Setup

```bash
# Run full setup (includes sample data, dbt setup, and tests)
pnpm setup:full

# Or run minimal setup
pnpm setup
```

### Start the Application

```bash
# Development mode
pnpm dev

# Production mode
pnpm build
pnpm start
```

## API Documentation

### Authentication

All API endpoints require JWT authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

#### Analytics KPIs

- `GET /api/v1/analytics/pipeline` - Pipeline metrics
- `GET /api/v1/analytics/compliance` - Compliance metrics  
- `GET /api/v1/analytics/revenue` - Revenue metrics
- `GET /api/v1/analytics/outreach` - Outreach metrics
- `GET /api/v1/analytics/kpis` - Combined KPIs

#### Query Parameters

- `startDate` - Filter by start date (ISO string)
- `endDate` - Filter by end date (ISO string)
- `facilityId` - Filter by facility (admin only)
- `includePII` - Include personally identifiable information

#### Admin Endpoints

- `POST /api/v1/analytics/refresh` - Trigger manual refresh
- `GET /api/v1/analytics/refresh/:jobId` - Check refresh job status
- `GET /api/v1/analytics/queue/stats` - Queue statistics

#### Health Check

- `GET /health` - Application health status
- `GET /api/v1/analytics/health` - Analytics health status

## dbt Integration

### Setup

```bash
# Navigate to dbt directory
cd dbt

# Configure environment variables
export DBT_USER=your_db_user
export DBT_PASSWORD=your_db_password
export DBT_DATABASE=analytics_db

# Run dbt transformations
pnpm analytics:run
```

### dbt Models

The dbt project includes:

- **Staging Models**: Clean raw data (`intermediate/*.sql`)
- **KPI Models**: Calculate metrics (`kpis/*.sql`)
- **Combined Model**: Unified analytics view

### dbt Commands

```bash
# Run all models
pnpm analytics:run

# Test data quality
pnpm analytics:test

# Generate documentation
pnpm analytics:docs
```

## Job Management

### Manual Refresh

```bash
# Refresh all analytics
pnpm analytics:refresh:all

# Refresh specific view
pnpm analytics:refresh:pipeline
pnpm analytics:refresh:compliance
pnpm analytics:refresh:revenue
pnpm analytics:refresh:outreach
```

### Database Setup

```bash
# Run database migrations
cd analytics-service
pnpm migrate

# Verify migrations
pnpm migrate:status
```

## Testing

```bash
# Run unit tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Generate coverage report
pnpm test:coverage
```

## Docker Support

### Full Stack Orchestration

The project includes a comprehensive Docker Compose stack that orchestrates all services:

```bash
# Setup local environment
./scripts/setup-local-env.sh

# Start all services
docker-compose up -d

# Check service health
./scripts/health-check.sh

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Services Included

- **PostgreSQL 15** with pgvector extension for vector embeddings
- **Redis** for caching and job queue
- **MinIO** S3-compatible object storage
- **Analytics API** (Node.js/Express)
- **ML Service** (FastAPI) for predictions and model training
- **Web Frontend** (Next.js)
- **Celery Worker & Beat** for background jobs and scheduling
- **Prometheus** for metrics collection
- **Grafana** for visualization (http://localhost:3002)
- **Jaeger** for distributed tracing (http://localhost:16686)
- **OpenTelemetry Collector** for telemetry aggregation

### Quick Access

After `docker-compose up -d`:

- **Analytics API**: http://localhost:3000
- **Web UI**: http://localhost:3001
- **ML Service**: http://localhost:8000
- **Grafana Dashboards**: http://localhost:3002 (admin/admin)
- **Jaeger Tracing**: http://localhost:16686
- **Prometheus**: http://localhost:9090
- **MinIO Console**: http://localhost:9001 (minioadmin/minioadmin)

### Configuration

Edit `.env` file before running `docker-compose up`:

```bash
# Database
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=analytics_db

# Analytics
JWT_SECRET=your-secret-key

# Observability
GRAFANA_PASSWORD=admin
```

For detailed Docker Compose documentation, see [DOCKER_COMPOSE.md](DOCKER_COMPOSE.md).

### Analytics Service Docker

```bash
# Build and start individual analytics service
cd analytics-service
pnpm docker:up

# View logs
pnpm docker:logs

# Stop services
pnpm docker:down
```

## Observability

The analytics stack ships with a complete observability suite powered by OpenTelemetry:

- **Distributed Tracing** via Jaeger
- **Metrics & Alerting** via Prometheus
- **Dashboards** via Grafana
- **Structured Logging** with correlation IDs and audit trails

### Running the Observability Stack

```bash
cd analytics-service
docker-compose up -d
```

This command starts the analytics API, PostgreSQL, Redis, and the observability services:

- OpenTelemetry Collector (OTLP on `4317`/`4318`)
- Jaeger UI at http://localhost:16686
- Prometheus at http://localhost:9090
- Grafana at http://localhost:3001 (admin/admin)

A detailed overview of the observability components is available in [`observability/README.md`](observability/README.md).

## Environment Variables

### Required

- `DATABASE_URL` - PostgreSQL connection string
- `REDIS_URL` - Redis connection string
- `JWT_SECRET` - JWT signing secret

### Optional

- `HIPAA_MODE` - Enable HIPAA compliance (default: false)
- `HIPAA_MIN_THRESHOLD` - Minimum data threshold (default: 5)
- `ANALYTICS_CACHE_TTL` - Cache TTL in seconds (default: 300)
- `ANALYTICS_REFRESH_INTERVAL` - Refresh interval in ms (default: 3600000)

## HIPAA Compliance

### Features

- **PII Redaction**: Automatic redaction of sensitive fields for unauthorized users
- **Minimum Threshold**: Data aggregation when counts fall below threshold
- **Audit Logging**: Comprehensive logging of data access
- **Secure Headers**: Security headers for HIPAA compliance

### Configuration

```env
HIPAA_MODE=true
HIPAA_MIN_THRESHOLD=5
```

## Migration History

This repository was created by migrating the analytics stack from the NurseHR repository. The migration preserved:

- Complete git history for all analytics files
- All database schemas and migrations
- API endpoints and functionality
- dbt models and configurations
- Job queue and refresh mechanisms
- HIPAA compliance features

The original development was tracked in the NurseHR repository under:
- Branch: `feature/analytics-backend-views-api-rbac-hipaa-refresh-dbt-redis`
- Task: `analytics-backend-views-api`

## License

[License information here]

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the test cases for usage examples
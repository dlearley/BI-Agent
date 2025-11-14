# Analytics API

FastAPI-based analytics and business intelligence API with modular architecture.

## Features

- **FastAPI** with async support
- **SQLAlchemy** ORM with async engine
- **Alembic** database migrations
- **Pydantic** schemas for validation
- **Modular architecture** (routers, services, repositories)
- **OpenAPI** documentation
- **Health check** endpoint

## Quick Start

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment:
```bash
cp .env.example .env
# Edit .env with your database configuration
```

3. Run database migrations:
```bash
alembic upgrade head
```

4. Start the server:
```bash
python run.py
```

The API will be available at `http://localhost:8000`

## API Documentation

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI Schema**: `http://localhost:8000/openapi.json`

## Health Check

Check if the API is running:
```bash
curl http://localhost:8000/api/v1/health
```

## Database Models

The API includes the following base models:

- **Organizations** - Tenant management
- **Users** - User management with roles
- **Teams** - Team organization
- **Memberships** - User-organization relationships
- **DataSources** - External data source connections
- **Datasets** - Data table definitions
- **Columns** - Dataset column metadata
- **Queries** - SQL query definitions
- **QueryRuns** - Query execution history
- **Dashboards** - Dashboard configurations
- **Widgets** - Dashboard widgets
- **Metrics** - Business metrics
- **Alerts** - Alert configurations
- **Reports** - Scheduled reports
- **Jobs** - Background job management
- **AuditLogs** - Audit trail
- **Embeddings** - Text embeddings
- **APIKeys** - API key management

## Architecture

```
apps/api/
├── app/
│   ├── core/           # Core configuration
│   ├── models/         # SQLAlchemy models
│   ├── schemas/        # Pydantic schemas
│   ├── routers/        # API routes
│   ├── services/       # Business logic
│   ├── repositories/   # Data access layer
│   └── main.py         # FastAPI app factory
├── alembic/            # Database migrations
├── tests/              # Test suite
├── requirements.txt    # Python dependencies
└── run.py             # Entry point
```

## Development

### Database Migrations

Create a new migration:
```bash
alembic revision --autogenerate -m "Description of changes"
```

Apply migrations:
```bash
alembic upgrade head
```

Rollback migrations:
```bash
alembic downgrade -1
```

### Testing

Run tests:
```bash
pytest
```

## Configuration

The application uses `pydantic-settings` for configuration management. All settings can be overridden via environment variables.

See `.env.example` for available configuration options.
# Monorepo

A monorepo structure for organizing multiple applications and shared packages.

## Directory Structure

```
.
├── apps/
│   ├── web/          # Web frontend application
│   ├── api/          # API backend service
│   ├── ml/           # Machine learning services
│   └── worker/       # Background job workers
├── packages/
│   ├── shared/       # Shared utilities and helpers
│   ├── sdk/          # Client SDK
│   ├── config/       # Configuration management
│   └── types/        # TypeScript type definitions
├── analytics-service/  # Existing analytics platform
├── dbt/              # dbt analytics project
├── jobs/             # Background jobs and scripts
└── observability/    # Observability configuration
```

## Applications

### apps/web
Web frontend application (to be implemented)

### apps/api
API backend service (to be implemented)

### apps/ml
Machine learning services (to be implemented)

### apps/worker
Background job workers (to be implemented)

## Packages

### packages/shared
Shared utilities, helpers, and common code used across applications.

### packages/sdk
Client SDK for interacting with the platform APIs.

### packages/config
Configuration management and environment handling.

### packages/types
Shared TypeScript type definitions used across the monorepo.

## Existing Components

### Analytics Platform
The repository includes a complete analytics and business intelligence platform in the `analytics-service/` directory. See [analytics documentation](./ANALYTICS_MIGRATION_VERIFICATION.md) for details.

#### Key Features
- PostgreSQL analytics with materialized views
- REST API with role-based access control (RBAC)
- Redis caching for performance
- BullMQ jobs for background processing
- HIPAA compliance features
- OpenTelemetry observability
- dbt integration for analytics engineering

## Getting Started

This monorepo is set up with the basic directory structure. Each application and package will have its own package.json and build configuration as they are developed.

## Development

The monorepo structure allows for:
- Shared code reuse across applications
- Consistent tooling and configurations
- Simplified dependency management
- Unified CI/CD pipelines

## License

[License information here]
# dbt Analytics Project

This directory contains a lightweight dbt project for analytics transformations. This is **optional** - the main application works with PostgreSQL views and materialized views directly. The dbt project provides additional data transformation capabilities and documentation generation.

## When to Use dbt

Use this dbt project when you need:
- Complex data transformations beyond simple aggregations
- Data quality testing
- Documentation generation
- Version-controlled analytics models
- Advanced analytics workflows

## Quick Start

### Prerequisites

- Python 3.8+
- dbt Core (Postgres adapter)

### Installation

```bash
# Install dbt
pip install dbt-postgres

# Set environment variables
export DBT_USER=your_db_user
export DBT_PASSWORD=your_db_password
export DBT_DATABASE=analytics_db
export DBT_HOST=localhost
export DBT_PORT=5432
```

### Configuration

The dbt project is configured in `profiles.yml`. You can customize:

- Development vs production environments
- Connection parameters
- Thread count for parallel execution
- Target schemas

### Running dbt

```bash
# From the project root
pnpm analytics:run

# Or directly from dbt directory
cd analytics/dbt

# Run all models
dbt run

# Run specific models
dbt run --select pipeline_kpis

# Run with full refresh
dbt run --full-refresh

# Test data quality
dbt test

# Generate documentation
dbt docs generate
dbt docs serve
```

## Project Structure

```
analytics/dbt/
├── dbt_project.yml          # Project configuration
├── profiles.yml              # Database profiles
├── models/
│   ├── kpis/                # KPI models
│   │   ├── pipeline_kpis.sql
│   │   ├── compliance_kpis.sql
│   │   ├── revenue_kpis.sql
│   │   ├── outreach_kpis.sql
│   │   └── combined_kpis.sql
│   └── intermediate/        # Staging models
│       ├── stg_applications.sql
│       ├── stg_invoices.sql
│       └── stg_outreach.sql
├── macros/
│   └── source_definitions.yml
└── README.md
```

## Models

### Staging Models (`stg_*.sql`)

Clean and prepare raw data:
- `stg_applications.sql` - Application data cleaning
- `stg_invoices.sql` - Invoice data cleaning  
- `stg_outreach.sql` - Outreach data cleaning

### KPI Models (`*_kpis.sql`)

Calculate analytics metrics:
- `pipeline_kpis.sql` - Recruitment pipeline metrics
- `compliance_kpis.sql` - Compliance and violation tracking
- `revenue_kpis.sql` - Revenue and financial metrics
- `outreach_kpis.sql` - Outreach effectiveness metrics
- `combined_kpis.sql` - Unified analytics view

## Integration with Main Application

### Option 1: dbt Only (Recommended for Analytics Teams)

Use dbt as the primary analytics engine:
- Raw data → dbt transformations → Analytics tables
- Application queries dbt-generated tables
- Full dbt feature set (tests, docs, etc.)

### Option 2: Hybrid Approach

Use both PostgreSQL views and dbt:
- PostgreSQL views for real-time metrics
- dbt for complex historical analysis
- Application uses both data sources

### Option 3: PostgreSQL Views Only (Default)

Skip dbt entirely:
- Use built-in PostgreSQL materialized views
- Simpler deployment and maintenance
- Good for basic analytics needs

## Data Quality Testing

Add tests to ensure data quality:

```sql
# tests/pipeline_kpi_tests.yml
version: 2

models:
  - name: pipeline_kpis
    tests:
      - not_null:
          column_names: [facility_id, month, total_applications]
      - dbt_utils.at_least_one:
          column_name: total_applications
      - accepted_values:
          column_name: facility_id
          values: "{{ var('facility_ids') }}"
```

## Documentation

Generate comprehensive documentation:

```bash
dbt docs generate
dbt docs serve
```

This creates:
- Data lineage diagrams
- Column documentation
- Model relationships
- Test results

## Environment Configuration

### Development
```yaml
# profiles.yml
dev:
  type: postgres
  host: localhost
  user: "{{ env_var('DBT_USER') }}"
  # ... other config
```

### Production
```yaml
# profiles.yml
prod:
  type: postgres
  host: "{{ env_var('DBT_HOST') }}"
  user: "{{ env_var('DBT_USER') }}"
  # ... other config
```

## Best Practices

1. **Version Control**: All dbt models should be version controlled
2. **Testing**: Add tests for critical data quality rules
3. **Documentation**: Document all models and columns
4. **Performance**: Use appropriate materialization strategies
5. **Security**: Use environment variables for credentials

## Custom Macros

Add custom macros in `macros/` directory:

```sql
# macros/hipaa_compliance.sql
{% macro hipaa_redaction(column_name) %}
  case 
    when current_setting('hipaa.mode', true) = 'true' 
         and not has_pii_permission() 
    then '[REDACTED]' 
    else {{ column_name }} 
  end
{% endmacro %}
```

## Scheduling

Schedule dbt runs using:
- Airflow
- dbt Cloud
- Cron jobs
- GitHub Actions

Example cron job:
```bash
# Run dbt every hour
0 * * * * cd /path/to/analytics/dbt && dbt run --profiles-dir . --target prod
```

## Troubleshooting

### Common Issues

1. **Connection Errors**: Check database credentials and network connectivity
2. **Permission Errors**: Ensure dbt user has required database permissions
3. **Compilation Errors**: Validate SQL syntax and model dependencies
4. **Performance Issues**: Optimize queries and use appropriate materialization

### Debug Mode

```bash
# Run with debug output
DBT_DEBUG=true dbt run

# Dry run to check compilation
dbt run --dry-run
```

## Integration with CI/CD

Add to your CI pipeline:

```yaml
# .github/workflows/dbt.yml
name: dbt CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      - name: Install dependencies
        run: pip install dbt-postgres
      - name: Run dbt tests
        run: dbt test --profiles-dir .
        env:
          DBT_USER: ${{ secrets.DBT_USER }}
          DBT_PASSWORD: ${{ secrets.DBT_PASSWORD }}
```

## Additional Resources

- [dbt Documentation](https://docs.getdbt.com/)
- [dbt Utils Package](https://hub.getdbt.com/dbt-labs/dbt_utils/)
- [PostgreSQL Adapter](https://docs.getdbt.com/docs/adapter/postgres)
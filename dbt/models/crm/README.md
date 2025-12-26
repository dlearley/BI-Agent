# CRM Data Warehouse Models

This directory contains dbt models for transforming raw CRM data into a dimensional data warehouse optimized for analytics and reporting.

## Architecture

The CRM data warehouse follows a classic dimensional modeling approach with staging layers, dimensions, and facts:

```
Raw Tables → Staging Models → Dimensional Models → Fact Tables → Dashboards/Reports
```

## Directory Structure

```
crm/
├── staging/              # Staging models (views)
│   ├── stg_crm_accounts.sql
│   ├── stg_crm_contacts.sql
│   ├── stg_crm_products.sql
│   ├── stg_crm_deals.sql
│   ├── stg_crm_activities.sql
│   ├── stg_crm_tickets.sql
│   ├── stg_crm_orders.sql
│   └── schema.yml       # Tests and documentation
├── dimensions/           # Dimension tables
│   ├── dim_accounts.sql
│   ├── dim_contacts.sql
│   ├── dim_products.sql
│   └── schema.yml       # Tests and documentation
├── facts/                # Fact tables
│   ├── fact_deals.sql
│   ├── fact_deal_stage_history.sql  # SCD Type 2
│   ├── fact_activities.sql
│   ├── fact_tickets.sql
│   ├── fact_orders.sql
│   └── schema.yml       # Tests and documentation
├── sources.yml           # Source table definitions
├── exposures.yml         # Dashboard and report definitions
└── README.md             # This file
```

## Models

### Staging Models

Staging models clean and standardize raw data with minimal transformation:

- **stg_crm_accounts**: Account data with standardized column names
- **stg_crm_contacts**: Contact data with full name concatenation
- **stg_crm_products**: Product data with margin calculations
- **stg_crm_deals**: Deal data with closed/won/overdue flags
- **stg_crm_activities**: Activity data with standardized structure
- **stg_crm_tickets**: Ticket data with resolution time calculations
- **stg_crm_orders**: Order data with fulfillment metrics

### Dimension Tables

Dimension tables provide descriptive context for analysis:

- **dim_accounts**: Company accounts with categorization and revenue segmentation
  - Type 1 SCD (current state only)
  - Enriched with account_category and revenue_segment
  
- **dim_contacts**: Individual contacts with seniority classification
  - Type 1 SCD (current state only)
  - Enriched with seniority_level derived from job titles
  - Includes account name for convenience
  
- **dim_products**: Product catalog with pricing and inventory status
  - Type 1 SCD (current state only)
  - Enriched with inventory_status and price_tier classifications
  - Includes profit calculations

### Fact Tables

Fact tables contain measurable business events and metrics:

- **fact_deals**: Sales opportunities and pipeline
  - Grain: One row per deal (current state)
  - Includes weighted amounts, pipeline metrics, stage change counts
  - Links to accounts, contacts
  
- **fact_deal_stage_history**: Deal stage progression history
  - Grain: One row per stage change per deal
  - Type 2 SCD tracking complete deal lifecycle
  - Includes stage movement classification (Forward/Backward)
  - Used for funnel analysis and conversion metrics
  
- **fact_activities**: Customer and sales activities
  - Grain: One row per activity
  - Covers calls, emails, meetings, notes, tasks
  - Time-series data with date hierarchies
  - Links to accounts, contacts, deals
  
- **fact_tickets**: Support tickets and resolution tracking
  - Grain: One row per ticket
  - Includes resolution metrics and SLA tracking
  - Links to accounts and contacts
  
- **fact_orders**: Customer orders and revenue
  - Grain: One row per order
  - Includes order value, fulfillment status, revenue calculations
  - Time-series data with date hierarchies

## Slowly Changing Dimensions (SCD)

### Type 1 SCD (Overwrite)

Used for dimensions where historical changes are not tracked:
- dim_accounts
- dim_contacts
- dim_products

These tables always reflect the current state and overwrite on updates.

### Type 2 SCD (Historical Tracking)

Used for tracking historical changes:
- **fact_deal_stage_history**: Tracks every stage change with timestamps
  - Enables funnel analysis
  - Calculates time spent in each stage
  - Tracks stage movement patterns (forward/backward)

## Data Quality Tests

All models include comprehensive data quality tests:

### Source Tests
- Not null constraints on critical fields
- Unique constraints on primary keys
- Accepted values for categorical fields
- Referential integrity checks

### Model Tests
- Primary key uniqueness and not null
- Foreign key references
- Business logic validation
- Data completeness checks

Run tests with:
```bash
dbt test --select crm
```

## Dashboard Exposures

The following dashboards and reports depend on these models:

1. **Sales Pipeline Dashboard** - Deal flow, win rates, forecasting
2. **Sales Activity Dashboard** - Team productivity, engagement metrics
3. **Customer Support Dashboard** - Ticket volume, SLA compliance
4. **Revenue Analytics Dashboard** - Order revenue, deal closures, LTV
5. **Account Health Dashboard** - Account engagement, risk scoring
6. **Product Performance Dashboard** - Sales, margins, inventory
7. **Sales Forecast Report** - Weekly pipeline forecasting
8. **Customer 360 View** - Comprehensive customer profile

## Running the Models

### Run all CRM models:
```bash
pnpm analytics:run --select crm
```

### Run specific layers:
```bash
# Staging only
dbt run --select tag:staging

# Dimensions only
dbt run --select tag:dimension

# Facts only
dbt run --select tag:fact
```

### Run with tests:
```bash
pnpm analytics:run --select crm
pnpm analytics:test --select crm
```

### Full refresh (recreate tables):
```bash
dbt run --select crm --full-refresh
```

## Lineage

To view the data lineage and model relationships:

```bash
pnpm analytics:docs
# or
cd dbt && dbt docs generate && dbt docs serve
```

This will generate and serve interactive documentation showing:
- Model dependency graphs
- Column-level lineage
- Test results
- Model descriptions

## Key Metrics Available

### Sales Metrics
- Pipeline value by stage
- Win rate and conversion rates
- Average deal size
- Sales cycle length
- Weighted pipeline value
- Stage velocity metrics

### Customer Support Metrics
- Ticket volume and trends
- Average resolution time
- SLA compliance rate
- First response time
- Ticket backlog

### Revenue Metrics
- Total revenue
- Revenue by product/category
- Average order value
- Customer lifetime value
- Order fulfillment rates

### Activity Metrics
- Activities per account
- Activity completion rates
- Activity-to-deal correlation
- Rep productivity metrics

## Performance Considerations

- **Staging models**: Materialized as views (no storage overhead)
- **Dimension tables**: Materialized as tables (fast query performance)
- **Fact tables**: Materialized as tables (optimized for aggregations)
- **Indexes**: Created on foreign keys and commonly filtered columns

## Maintenance

### Regular Tasks
1. Run dbt models daily or on-demand
2. Monitor test failures
3. Update documentation as models evolve
4. Review and optimize slow-running models

### Troubleshooting
```bash
# Debug a specific model
dbt run --select model_name --debug

# Compile SQL without running
dbt compile --select model_name

# View compiled SQL
cat target/compiled/analytics/models/crm/[model].sql
```

## Future Enhancements

Potential improvements to consider:
1. Add incremental models for large fact tables
2. Implement Type 2 SCD for accounts and contacts if historical tracking is needed
3. Add aggregate/mart tables for common queries
4. Create customer cohort analysis models
5. Add predictive models for churn and upsell
6. Implement data quality monitoring and alerting

## Support

For questions or issues with the CRM models:
1. Review the dbt documentation: https://docs.getdbt.com/
2. Check model-specific documentation in schema.yml files
3. Review the lineage diagram for dependencies
4. Consult the main project README.md

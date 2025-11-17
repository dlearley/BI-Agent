# CRM Metrics Implementation Guide

## Overview

This implementation provides comprehensive CRM metrics for sales, support, and customer success teams. The metrics are built as dbt models with materialized views, SQL macros for weighted forecasts, and snapshots for trend tracking.

## Project Structure

```
dbt/
├── models/
│   ├── intermediate/              # Staging models
│   │   ├── stg_applications.sql
│   │   ├── stg_invoices.sql
│   │   ├── stg_leads.sql          # NEW
│   │   ├── stg_opportunities.sql  # NEW
│   │   ├── stg_outreach.sql
│   │   ├── stg_tickets.sql        # NEW
│   │   └── stg_satisfaction.sql   # NEW
│   ├── kpis/                      # KPI models
│   │   ├── combined_kpis.sql
│   │   ├── compliance_kpis.sql
│   │   ├── conversion_funnel.sql          # NEW
│   │   ├── cohort_retention.sql           # NEW
│   │   ├── health_scores.sql              # NEW
│   │   ├── outreach_kpis.sql
│   │   ├── pipeline_kpis.sql
│   │   ├── rep_activity_by_channel.sql    # NEW
│   │   ├── revenue_kpis.sql
│   │   ├── satisfaction_rollups.sql       # NEW
│   │   ├── ticket_sla_compliance.sql      # NEW
│   │   ├── weighted_pipeline_scenarios.sql# NEW
│   │   └── schema.yml
│   └── snapshots/                 # Historical tracking
│       ├── pipeline_kpi_snapshot.sql
│       ├── conversion_funnel_snapshot.sql
│       └── health_score_snapshot.sql
├── macros/
│   ├── source_definitions.yml     # Updated with CRM tables
│   └── weighted_forecast.sql      # NEW - Weighted calculation macros
├── data/                          # Seed data
│   ├── leads.csv                  # NEW
│   ├── opportunities.csv          # NEW
│   ├── tickets.csv                # NEW
│   └── satisfaction.csv           # NEW
├── tests/
│   ├── test_conversion_funnel_logic.sql
│   ├── test_health_score_range.sql
│   └── test_sla_compliance_rates.sql
├── dbt_project.yml                # Updated with KPI configurations
├── METRICS_VALIDATION.md          # Test case documentation
└── CRM_METRICS_README.md          # This file
```

## Key Metrics

### 1. Weighted Pipeline Scenarios
Calculates pipeline value with weighted forecasts by stage and win probability.

**Model**: `weighted_pipeline_scenarios.sql`
**Dimensions**: facility_id, rep_id, stage, month
**Key Metrics**:
- `total_pipeline_value`: Sum of opportunity amounts
- `weighted_pipeline_value`: Amount × win_probability × stage_weight
- `avg_win_probability`: Aggregated probability by stage
- `weight_factor`: Ratio of weighted to total value

**Stage Weights**:
- Lead: weight 0.1, probability 15%
- SQL: weight 0.25, probability 30%
- Opportunity: weight 0.5, probability 50%
- Won: weight 1.0, probability 100%

### 2. Conversion Funnel
Tracks lead progression through sales pipeline with conversion rates.

**Model**: `conversion_funnel.sql`
**Dimensions**: facility_id, rep_id, month, funnel_stage
**Key Metrics**:
- `stage_count`: Number of opportunities in stage
- `conversion_rate_pct`: Conversion from previous stage
- `funnel_stage`: Lead → SQL → Opportunity → Won

### 3. Cohort Retention
Analyzes cohort retention and progression over time.

**Model**: `cohort_retention.sql`
**Dimensions**: facility_id, rep_id, cohort_month, months_since_cohort
**Key Metrics**:
- `retention_rate_pct`: Percentage of original cohort still active
- `progression_rate_pct`: Percentage progressed to opportunity/won

### 4. Rep Activity by Channel
Measures sales rep activity effectiveness across outreach channels.

**Model**: `rep_activity_by_channel.sql`
**Dimensions**: rep_id, facility_id, channel, month
**Key Metrics**:
- `total_outreach`: Number of outreach activities
- `response_rate_pct`: Response rate
- `conversion_rate_pct`: Conversion rate
- `channel_effectiveness_rank`: Performance ranking

### 5. Ticket SLA Compliance
Tracks support ticket SLA performance by priority.

**Model**: `ticket_sla_compliance.sql`
**Dimensions**: facility_id, priority, month
**Key Metrics**:
- `sla_compliance_rate_pct`: Tickets meeting SLA targets
- `avg_first_response_hours`: Average first response time
- `avg_resolution_hours`: Average resolution time
- `sla_response_target`: Target response time by priority
- `sla_resolution_target`: Target resolution time by priority

**SLA Targets**:
- Critical: 1h response, 4h resolution
- High: 2h response, 24h resolution
- Medium: 4h response, 72h resolution
- Low: 8h response, 120h resolution

### 6. Satisfaction Rollups
Aggregates CSAT and NPS survey data.

**Model**: `satisfaction_rollups.sql`
**Dimensions**: facility_id, month, metric_type (csat/nps)
**Key Metrics**:
- `avg_score`: Average satisfaction score
- `promoter_or_satisfaction_pct`: % satisfied or promoters
- `detractor_rate_pct`: % detractors or dissatisfied
- `month_over_month_change`: Score trend

### 7. Health Scores
Comprehensive facility health combining five KPI components.

**Model**: `health_scores.sql`
**Dimensions**: facility_id, month
**Key Metrics**:
- `overall_health_score`: Composite score (0-100)
- `health_status`: Status level (excellent/good/fair/poor)
- `compliance_score`: Component score
- `pipeline_health`: Component score
- `conversion_health`: Component score
- `sla_health`: Component score
- `satisfaction_health`: Component score

**Health Thresholds**:
- Excellent: 80-100
- Good: 60-79
- Fair: 40-59
- Poor: 0-39

## SQL Macros

### Weighted Forecast
```sql
{{ weighted_forecast(values_column, weights_column, scenario_filter) }}
```
Calculates weighted average when scenario enabled, simple average when disabled.

### Scenario Toggle
```sql
{{ scenario_toggle(column, scenario_enabled, true_value, false_value) }}
```
Switches between two values based on scenario condition.

### Weighted Pipeline Scenario
```sql
{{ weighted_pipeline_scenario(base_amount, win_probability, pipeline_stage_weight, apply_weighting) }}
```
Calculates weighted pipeline value: amount × probability × stage_weight

## Snapshots

Three snapshot models track historical changes:

1. **pipeline_kpi_snapshot**: Tracks pipeline metrics by facility/month
2. **conversion_funnel_snapshot**: Tracks conversion rates by rep/stage
3. **health_score_snapshot**: Tracks health score components over time

Run snapshots with: `dbt snapshot`

## Seed Data

Test data included for validation:

- **leads.csv** (12 records): Pipeline opportunities across stages
- **opportunities.csv** (6 records): Qualified opportunities
- **tickets.csv** (10 records): Support tickets with SLA tracking
- **satisfaction.csv** (10 records): CSAT and NPS responses

Load seeds with: `dbt seed`

## Refresh Configuration

All KPI models are configured as materialized tables with SLA targets:

| Model | Frequency | SLA |
|-------|-----------|-----|
| weighted_pipeline_scenarios | Daily | 2 hours |
| conversion_funnel | Daily | 2 hours |
| cohort_retention | Daily | 4 hours |
| rep_activity_by_channel | Daily | 3 hours |
| ticket_sla_compliance | Daily | 1 hour |
| satisfaction_rollups | Daily | 4 hours |
| health_scores | Daily | 2 hours |

Refresh jobs are configured in `jobs/kpi_refresh_config.yml` with:
- Scheduled refresh times
- SLA monitoring
- Retry logic
- Failure notifications
- Dependencies for health_scores

## Exposures

All metrics are exposed with ownership and criticality:

- CRM Weighted Pipeline (HIGH) - Sales Operations
- CRM Conversion Funnel (HIGH) - Sales Leadership
- CRM Cohort Retention (MEDIUM) - Revenue Operations
- Rep Activity Dashboard (MEDIUM) - Sales Management
- Support SLA Monitoring (HIGH) - Customer Success
- Customer Satisfaction Analytics (HIGH) - Customer Success
- Facility Health Scorecard (CRITICAL) - Executive Leadership

View exposures with: `dbt docs generate`

## Testing

Run validation tests:

```bash
# All tests
dbt test

# Specific test
dbt test --select test_conversion_funnel_logic
dbt test --select test_sla_compliance_rates
dbt test --select test_health_score_range
```

## Usage Examples

### Query weighted pipeline for January 2024
```sql
select 
  facility_id,
  rep_id,
  stage,
  total_pipeline_value,
  weighted_pipeline_value,
  avg_win_probability
from analytics.weighted_pipeline_scenarios
where month = '2024-01-01'
order by weighted_pipeline_value desc;
```

### Query conversion funnel by month
```sql
select 
  month,
  funnel_stage,
  stage_count,
  conversion_rate_pct
from analytics.conversion_funnel
where facility_id = 'fac_001'
order by month desc, 
  case funnel_stage 
    when 'lead' then 1 
    when 'sql' then 2 
    when 'opportunity' then 3 
    when 'won' then 4 
  end;
```

### Query health scores for executive dashboard
```sql
select 
  facility_id,
  month,
  overall_health_score,
  health_status,
  compliance_score,
  pipeline_health,
  conversion_health,
  sla_health,
  satisfaction_health
from analytics.health_scores
where month >= date_trunc('month', current_date - interval '12 months')
order by month desc, overall_health_score desc;
```

### Query SLA compliance by priority
```sql
select 
  facility_id,
  priority,
  sla_compliance_rate_pct,
  avg_first_response_hours,
  avg_resolution_hours
from analytics.ticket_sla_compliance
where month = date_trunc('month', current_date)
order by priority, sla_compliance_rate_pct;
```

## Performance Considerations

### Indexing Recommendations
Create indexes on frequently filtered columns:
```sql
create index idx_weighted_pipeline_facility_month 
  on analytics.weighted_pipeline_scenarios(facility_id, month);
  
create index idx_conversion_funnel_rep_month 
  on analytics.conversion_funnel(rep_id, month);
  
create index idx_health_scores_facility_month 
  on analytics.health_scores(facility_id, month);
```

### Materialized View Refresh
Models use incremental refresh where possible to minimize refresh time. Consider:
- Refresh during off-peak hours (2-4 AM)
- Prioritize critical models (SLA, Health Scores)
- Monitor refresh durations against SLA targets

## Troubleshooting

### Model fails to compile
- Check that all source tables exist in raw schema
- Verify seed data is loaded: `dbt seed`
- Review column names in stg_*.sql files

### Slow refresh times
- Check database indexes exist
- Monitor query plans for full table scans
- Consider incremental refresh patterns
- Check database resource utilization

### Inaccurate metrics
- Verify seed data matches production schema
- Check for null values in critical columns
- Review date/time calculations
- Confirm SLA thresholds match business rules

## Contributing

When adding new metrics:
1. Create model in `models/kpis/`
2. Add source definitions if new tables used
3. Include snapshot if historical tracking needed
4. Add tests for validation
5. Document in schema.yml with owner and criticality
6. Update dbt_project.yml with refresh SLA
7. Update this README with new metric documentation

## References

- dbt Documentation: https://docs.getdbt.com/
- dbt Best Practices: https://docs.getdbt.com/guides/best-practices
- Snapshot Strategy: https://docs.getdbt.com/docs/build/snapshots
- Macros: https://docs.getdbt.com/docs/build/macros-overview

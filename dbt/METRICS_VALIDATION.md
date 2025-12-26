# CRM Metrics Validation Documentation

## Overview
This document outlines the CRM metrics implementation, including models, macros, snapshots, and validation test cases against the seed dataset.

## Models Implemented

### 1. Weighted Pipeline Scenarios (`weighted_pipeline_scenarios.sql`)
**Purpose**: Calculate pipeline value with weighted forecast scenarios by stage

**Key Features**:
- Stage-based weighting: Lead (0.1), SQL (0.25), Opportunity (0.5), Won (1.0)
- Win probability adjustment: Lead (15%), SQL (30%), Opportunity (50%), Won (100%)
- Weighted pipeline formula: `amount * win_probability * stage_weight`
- Aggregated by facility, rep, and month

**Expected Test Results** (from seed data):
- Lead stage: 9 opportunities, total value $395,000, weighted value ~$59,250
- SQL stage: 6 opportunities, total value $355,000, weighted value ~$105,750
- Opportunity stage: 6 opportunities, total value $350,000, weighted value ~$175,000
- Won stage: 6 opportunities, total value $515,000, weighted value $515,000

### 2. Conversion Funnel (`conversion_funnel.sql`)
**Purpose**: Track conversion rates through pipeline stages: Lead → SQL → Opportunity → Won

**Key Features**:
- Multi-stage funnel tracking with progressive conversion rates
- Lag function to calculate conversion from previous stage
- Aggregated by facility, rep, and month
- Each stage shows count and conversion percentage

**Expected Test Results** (from seed data):
- Lead stage: 12 leads
- SQL stage: 6 leads (50% conversion from leads)
- Opportunity stage: 6 leads (100% progression)
- Won stage: 6 closed deals (100% from opportunities)

### 3. Cohort Retention (`cohort_retention.sql`)
**Purpose**: Track lead cohort retention and progression through months

**Key Features**:
- Cohort-based analysis with month-since-cohort calculations
- Retention rate: percentage of original cohort still active
- Progression rate: percentage progressed to opportunity/won stages
- Status weighting: Won (1.0), Lost (0.0), Active (0.5)

**Expected Test Results** (from seed data - Jan 2024 cohort):
- Month 0: 8 leads created
- Retention at M0: 100%
- Progression at M0: 37.5% (3/8 to opportunity/won)
- By M1: 3 leads progressed (Won), 5 still active

### 4. Rep Activity by Channel (`rep_activity_by_channel.sql`)
**Purpose**: Track sales representative activity and effectiveness by outreach channel

**Key Features**:
- Activity metrics by rep, facility, and channel
- Response rate: responses / total outreach
- Conversion rate: conversions / total outreach
- Channel effectiveness ranking by conversion rate
- Unassigned activity tracked separately

**Expected Test Results** (from seed data):
- Email channel typical: 40-50% response rate
- Social channel typical: 30-40% conversion rate
- Best performing reps based on combined metrics

### 5. Ticket SLA Compliance (`ticket_sla_compliance.sql`)
**Purpose**: Track support ticket SLA performance and response times

**Key Features**:
- SLA targets by priority: Critical (1h response, 4h resolution), High (2h/24h), Medium (4h/72h), Low (8h/120h)
- SLA compliance rate calculation
- Response and resolution time tracking
- Percentile analysis (median included)
- Aggregated by facility and priority

**Expected Test Results** (from seed data):
- Total tickets: 10 (7 resolved, 3 open)
- Critical: 100% SLA compliance (3/3 met)
- High: 66.7% SLA compliance (2/3 met)
- Medium: 100% SLA compliance (2/2 met)
- Avg first response: ~2.1 hours
- Avg resolution: ~17.8 hours

### 6. Satisfaction Rollups (`satisfaction_rollups.sql`)
**Purpose**: Aggregate CSAT and NPS survey data

**Key Features**:
- Separate aggregations for CSAT and NPS metrics
- CSAT score 4-5: satisfied, 1-2: dissatisfied
- NPS: 9-10: promoters, 7-8: passives, 0-6: detractors
- NPS calculation: (promoters - detractors) / respondents * 100
- Month-over-month change tracking
- Percentile analysis

**Expected Test Results** (from seed data):
- CSAT average: ~4.0 across both facilities
- NPS average: ~40 (favorable)
- fac_001 CSAT: 4.0 (3 responses, 100% satisfied)
- fac_002 CSAT: 3.67 (3 responses, 66.7% satisfied)
- fac_001 NPS: 50 (2 responses, promoter rate 50%)
- fac_002 NPS: 33.3 (2 responses, promoter rate 50%)

### 7. Health Scores (`health_scores.sql`)
**Purpose**: Comprehensive facility health scores combining multiple KPIs

**Key Features**:
- Combines: compliance, pipeline, conversion, SLA, and satisfaction
- Overall score: average of 5 components (0-100)
- Health status: Excellent (80+), Good (60-79), Fair (40-59), Poor (<40)
- Component scoring from respective KPI models
- Aggregated by facility and month

**Expected Test Results** (from seed data):
- fac_001 overall health: ~75 (Good)
  - Pipeline: 80-85
  - Conversion: 75-80
  - SLA: 95+ (high compliance)
- fac_002 overall health: ~70 (Good)
  - Pipeline: 75-80
  - Conversion: 75-80
  - SLA: 85-90

## Macros Implemented

### 1. Weighted Forecast Macro
```sql
{{ weighted_forecast(values_column, weights_column, scenario_filter) }}
```
**Purpose**: Calculate weighted forecast values with scenario toggles

**Parameters**:
- `values_column`: Column containing values to weight
- `weights_column`: Column containing weight factors
- `scenario_filter`: Boolean condition for scenario toggle

**Behavior**:
- When scenario enabled: weighted average calculation
- When scenario disabled: simple average

### 2. Scenario Toggle Macro
```sql
{{ scenario_toggle(column, scenario_enabled, true_value, false_value) }}
```
**Purpose**: Toggle between two values based on scenario flag

**Parameters**:
- `column`: The column to potentially modify
- `scenario_enabled`: Boolean condition for scenario
- `true_value`: Value when scenario enabled
- `false_value`: Value when scenario disabled

### 3. Weighted Pipeline Scenario Macro
```sql
{{ weighted_pipeline_scenario(base_amount, win_probability, pipeline_stage_weight, apply_weighting) }}
```
**Purpose**: Calculate weighted pipeline opportunity value

**Parameters**:
- `base_amount`: Base opportunity amount
- `win_probability`: Probability of winning (0-1)
- `pipeline_stage_weight`: Weight factor for pipeline stage
- `apply_weighting`: Boolean to enable weighted calculation

## Snapshots Implemented

### 1. Pipeline KPI Snapshot
- **Target Schema**: analytics
- **Unique Key**: [facility_id, month]
- **Strategy**: timestamp (updated_at field)
- **Purpose**: Track historical pipeline KPI changes

### 2. Conversion Funnel Snapshot
- **Target Schema**: analytics
- **Unique Key**: [facility_id, rep_id, month, funnel_stage]
- **Strategy**: timestamp (updated_at field)
- **Purpose**: Track conversion rate changes over time

### 3. Health Score Snapshot
- **Target Schema**: analytics
- **Unique Key**: [facility_id, month]
- **Strategy**: timestamp (updated_at field)
- **Purpose**: Track health score evolution and component changes

## Materialized View Refresh Configuration

Models are configured as materialized tables with refresh SLAs:

| Model | Frequency | SLA (hours) | Criticality |
|-------|-----------|------------|-------------|
| weighted_pipeline_scenarios | Daily | 2 | High |
| conversion_funnel | Daily | 2 | High |
| cohort_retention | Daily | 4 | Medium |
| rep_activity_by_channel | Daily | 3 | Medium |
| ticket_sla_compliance | Daily | 1 | High |
| satisfaction_rollups | Daily | 4 | Medium |
| health_scores | Daily | 2 | Critical |

## Test Cases

### Test 1: Conversion Funnel Logic
**File**: `tests/test_conversion_funnel_logic.sql`
**Query**: Select from conversion_funnel where funnel_stage not in ('lead', 'sql', 'opportunity', 'won')
**Expected**: 0 rows (validates only valid stages present)

### Test 2: SLA Compliance Rate Bounds
**File**: `tests/test_sla_compliance_rates.sql`
**Query**: Select from ticket_sla_compliance where sla_compliance_rate_pct < 0 or > 100
**Expected**: 0 rows (validates percentage is 0-100)

### Test 3: Health Score Range
**File**: `tests/test_health_score_range.sql`
**Query**: Select from health_scores where overall_health_score < 0 or > 100 or invalid status
**Expected**: 0 rows (validates score range and valid status values)

## Exposure Definitions

All metrics are exposed with owner and criticality information:

- **CRM Weighted Pipeline** (HIGH): Sales Operations
- **CRM Conversion Funnel** (HIGH): Sales Leadership
- **CRM Cohort Retention** (MEDIUM): Revenue Operations
- **Rep Activity Dashboard** (MEDIUM): Sales Management
- **Support SLA Monitoring** (HIGH): Customer Success
- **Customer Satisfaction Analytics** (HIGH): Customer Success
- **Facility Health Scorecard** (CRITICAL): Executive Leadership

## Running Tests and Validation

```bash
# Run all tests
dbt test

# Run specific test
dbt test --select test_conversion_funnel_logic

# Generate test documentation
dbt docs generate

# Run snapshots
dbt snapshot

# Run seed data load
dbt seed
```

## Seed Data Summary

### Leads (12 records)
- Created Jan-Feb 2024
- Distributed across 2 facilities and 4 reps
- Pipeline stages: lead, sql, opportunity, won, lost
- Total value: $765,000

### Opportunities (6 records)
- Linked to qualified leads
- 4 won, 2 open status
- Total value: $490,000

### Tickets (10 records)
- Created Jan-Feb 2024
- Distributed across priorities
- 7 resolved, 3 open
- SLA compliance: 90%

### Satisfaction (10 records)
- Mix of CSAT (1-5) and NPS (0-10)
- 5 CSAT, 5 NPS responses
- Distributed across 2 facilities

## Expected Output Numbers

Based on seed dataset validation:

**January 2024:**
- Pipeline value (weighted): $750K
- Conversion rate (L→SQL): 50%
- SLA compliance: 95%
- Avg CSAT: 4.0
- Overall health score: ~73

**February 2024:**
- Pipeline value (weighted): $495K
- Conversion rate (L→SQL): 60%
- SLA compliance: 100%
- Avg CSAT: 4.5
- Overall health score: ~78

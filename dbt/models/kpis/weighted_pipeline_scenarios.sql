{{--
  Weighted Pipeline Scenarios KPI Model
  Calculates pipeline value with weighted forecast scenarios by stage
--}}

with leads as (
    select 
        facility_id,
        rep_id,
        stage,
        amount,
        status,
        created_at,
        qualified_at,
        closed_at,
        date_trunc('month', created_at) as month
    from {{ source('raw', 'leads') }}
    where created_at >= dateadd('month', -12, current_date)
),

stage_weights as (
    select 
        'lead' as stage,
        0.1 as stage_weight,
        0.15 as win_probability
    union all select 'sql', 0.25, 0.30
    union all select 'opportunity', 0.50, 0.50
    union all select 'won', 1.0, 1.0
    union all select 'lost', 0.0, 0.0
),

pipeline_with_weights as (
    select 
        l.facility_id,
        l.rep_id,
        l.stage,
        l.month,
        l.amount,
        coalesce(sw.stage_weight, 0) as stage_weight,
        coalesce(sw.win_probability, 0) as win_probability,
        count(*) as opportunity_count,
        {{ weighted_pipeline_scenario(
            'l.amount', 
            'coalesce(sw.win_probability, 0)',
            'coalesce(sw.stage_weight, 0)',
            'true'
        ) }} as weighted_amount
    from leads l
    left join stage_weights sw on l.stage = sw.stage
    group by 
        l.facility_id, l.rep_id, l.stage, l.month, l.amount,
        sw.stage_weight, sw.win_probability
),

scenario_aggregation as (
    select 
        facility_id,
        rep_id,
        month,
        stage,
        count(opportunity_count) as total_opportunities,
        sum(amount) as total_pipeline_value,
        sum(weighted_amount) as weighted_pipeline_value,
        avg(win_probability) as avg_win_probability,
        avg(stage_weight) as avg_stage_weight,
        round(
            sum(weighted_amount) / nullif(sum(amount), 0), 4
        ) as weight_factor
    from pipeline_with_weights
    group by facility_id, rep_id, month, stage
)

select 
    facility_id,
    rep_id,
    month,
    stage,
    total_opportunities,
    round(total_pipeline_value, 2) as total_pipeline_value,
    round(weighted_pipeline_value, 2) as weighted_pipeline_value,
    round(avg_win_probability, 4) as avg_win_probability,
    round(avg_stage_weight, 4) as avg_stage_weight,
    weight_factor,
    current_timestamp as dbt_updated_at
from scenario_aggregation
order by facility_id, rep_id, month desc, stage

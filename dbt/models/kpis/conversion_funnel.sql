{{--
  Conversion Funnel KPI Model
  Tracks conversion rates through pipeline stages: Lead → SQL → Opportunity → Won
--}}

with leads_stage as (
    select 
        facility_id,
        rep_id,
        date_trunc('month', created_at) as month,
        'lead' as funnel_stage,
        count(distinct id) as stage_count,
        count(distinct id) as cumulative_count
    from {{ source('raw', 'leads') }}
    where created_at >= dateadd('month', -12, current_date)
    group by facility_id, rep_id, month
),

sql_stage as (
    select 
        facility_id,
        rep_id,
        date_trunc('month', qualified_at) as month,
        'sql' as funnel_stage,
        count(distinct id) as stage_count,
        count(distinct id) as cumulative_count
    from {{ source('raw', 'leads') }}
    where qualified_at is not null
        and qualified_at >= dateadd('month', -12, current_date)
    group by facility_id, rep_id, month
),

opportunities_stage as (
    select 
        o.facility_id,
        o.rep_id,
        date_trunc('month', o.created_at) as month,
        'opportunity' as funnel_stage,
        count(distinct o.id) as stage_count,
        count(distinct o.id) as cumulative_count
    from {{ source('raw', 'opportunities') }} o
    where o.created_at >= dateadd('month', -12, current_date)
    group by o.facility_id, o.rep_id, month
),

won_stage as (
    select 
        o.facility_id,
        o.rep_id,
        date_trunc('month', o.closed_at) as month,
        'won' as funnel_stage,
        count(distinct o.id) as stage_count,
        count(distinct o.id) as cumulative_count
    from {{ source('raw', 'opportunities') }} o
    where o.status = 'won'
        and o.closed_at >= dateadd('month', -12, current_date)
    group by o.facility_id, o.rep_id, month
),

funnel_combined as (
    select * from leads_stage
    union all select * from sql_stage
    union all select * from opportunities_stage
    union all select * from won_stage
),

funnel_ranked as (
    select 
        facility_id,
        rep_id,
        month,
        funnel_stage,
        stage_count,
        cumulative_count,
        row_number() over (
            partition by facility_id, rep_id, month 
            order by 
                case funnel_stage 
                    when 'lead' then 1 
                    when 'sql' then 2 
                    when 'opportunity' then 3 
                    when 'won' then 4 
                end
        ) as stage_position
    from funnel_combined
),

funnel_with_conversions as (
    select 
        facility_id,
        rep_id,
        month,
        funnel_stage,
        stage_count,
        lag(stage_count, 1) over (
            partition by facility_id, rep_id, month 
            order by stage_position
        ) as previous_stage_count,
        round(
            (stage_count * 100.0 / 
            nullif(
                lag(stage_count, 1) over (
                    partition by facility_id, rep_id, month 
                    order by stage_position
                ), 0
            )), 2
        ) as conversion_rate_from_previous
    from funnel_ranked
)

select 
    facility_id,
    rep_id,
    month,
    funnel_stage,
    stage_count,
    coalesce(previous_stage_count, stage_count) as previous_stage_count,
    coalesce(conversion_rate_from_previous, 100.0) as conversion_rate_pct,
    current_timestamp as dbt_updated_at
from funnel_with_conversions
order by facility_id, rep_id, month desc, 
    case funnel_stage 
        when 'lead' then 1 
        when 'sql' then 2 
        when 'opportunity' then 3 
        when 'won' then 4 
    end

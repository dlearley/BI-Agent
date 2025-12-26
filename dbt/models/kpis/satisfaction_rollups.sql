{{--
  CSAT/NPS Rollups KPI Model
  Aggregates customer satisfaction scores (CSAT) and Net Promoter Score (NPS)
--}}

with satisfaction_data as (
    select 
        facility_id,
        survey_type,
        score,
        created_at,
        feedback,
        date_trunc('month', created_at) as month
    from {{ source('raw', 'satisfaction') }}
    where created_at >= dateadd('month', -12, current_date)
),

csat_nps_split as (
    select 
        facility_id,
        month,
        'csat' as metric_type,
        count(*) as response_count,
        round(avg(score), 2) as avg_score,
        round(
            count(case when score >= 4 then 1 end) * 100.0 / nullif(count(*), 0), 2
        ) as satisfaction_rate_pct,
        round(
            count(case when score <= 2 then 1 end) * 100.0 / nullif(count(*), 0), 2
        ) as detractor_rate_pct,
        min(score) as min_score,
        max(score) as max_score,
        percentile_cont(0.5) within group (order by score) as median_score
    from satisfaction_data
    where survey_type = 'csat'
    group by facility_id, month
    
    union all
    
    select 
        facility_id,
        month,
        'nps' as metric_type,
        count(*) as response_count,
        round(
            (count(case when score >= 9 then 1 end) - 
             count(case when score <= 6 then 1 end)) * 100.0 / 
            nullif(count(*), 0), 2
        ) as avg_score,
        round(
            count(case when score >= 9 then 1 end) * 100.0 / nullif(count(*), 0), 2
        ) as promoter_rate_pct,
        round(
            count(case when score <= 6 then 1 end) * 100.0 / nullif(count(*), 0), 2
        ) as detractor_rate_pct,
        min(score) as min_score,
        max(score) as max_score,
        percentile_cont(0.5) within group (order by score) as median_score
    from satisfaction_data
    where survey_type = 'nps'
    group by facility_id, month
),

satisfaction_with_trends as (
    select 
        facility_id,
        month,
        metric_type,
        response_count,
        avg_score,
        satisfaction_rate_pct as promoter_or_satisfaction_pct,
        detractor_rate_pct,
        min_score,
        max_score,
        median_score,
        lag(avg_score) over (
            partition by facility_id, metric_type 
            order by month
        ) as previous_month_score,
        round(
            avg_score - lag(avg_score) over (
                partition by facility_id, metric_type 
                order by month
            ), 2
        ) as month_over_month_change
    from csat_nps_split
)

select 
    facility_id,
    month,
    metric_type,
    response_count,
    avg_score,
    promoter_or_satisfaction_pct,
    detractor_rate_pct,
    min_score,
    max_score,
    median_score,
    previous_month_score,
    month_over_month_change,
    current_timestamp as dbt_updated_at
from satisfaction_with_trends
order by facility_id, month desc, metric_type

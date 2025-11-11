{{--
  Pipeline KPIs Model
  Calculates pipeline metrics including application counts, time-to-fill, and conversion rates
--}}

with applications as (
    select 
        facility_id,
        created_at,
        hired_at,
        status,
        date_trunc('month', created_at) as month
    from {{ source('raw', 'applications') }}
    where created_at >= dateadd('month', -12, current_date)
),

pipeline_metrics as (
    select 
        facility_id,
        month,
        count(*) as total_applications,
        count(case when status = 'hired' then 1 end) as hired_count,
        count(case when status = 'rejected' then 1 end) as rejected_count,
        count(case when status = 'pending' then 1 end) as pending_count,
        count(case when status = 'interview' then 1 end) as interview_count,
        avg(
            case 
                when status = 'hired' and hired_at is not null 
                then datediff('day', created_at, hired_at) 
            end
        ) as avg_time_to_fill_days
    from applications
    group by facility_id, month
)

select 
    facility_id,
    month,
    total_applications,
    hired_count,
    rejected_count,
    pending_count,
    interview_count,
    round(avg_time_to_fill_days, 2) as avg_time_to_fill_days,
    current_timestamp as dbt_updated_at
from pipeline_metrics
order by facility_id, month desc
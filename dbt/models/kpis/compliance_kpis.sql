{{--
  Compliance KPIs Model
  Calculates compliance metrics and violation tracking
--}}

with applications as (
    select 
        facility_id,
        created_at,
        compliance_score,
        has_violations,
        date_trunc('month', created_at) as month
    from {{ source('raw', 'applications') }}
    where created_at >= dateadd('month', -12, current_date)
),

compliance_metrics as (
    select 
        facility_id,
        month,
        count(*) as total_applications,
        count(case when compliance_score >= 80 then 1 end) as compliant_applications,
        avg(compliance_score) as avg_compliance_score,
        count(case when has_violations = true then 1 end) as violation_count
    from applications
    group by facility_id, month
)

select 
    facility_id,
    month,
    total_applications,
    compliant_applications,
    round(avg_compliance_score, 2) as avg_compliance_score,
    violation_count,
    round(
        (compliant_applications * 100.0 / nullif(total_applications, 0)), 2
    ) as compliance_rate,
    current_timestamp as dbt_updated_at
from compliance_metrics
order by facility_id, month desc
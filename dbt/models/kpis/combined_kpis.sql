{{--
  Combined KPIs Model
  Combines all KPI metrics into a single comprehensive view
--}}

with pipeline as (
    select * from {{ ref('pipeline_kpis') }}
),

compliance as (
    select * from {{ ref('compliance_kpis') }}
),

revenue as (
    select * from {{ ref('revenue_kpis') }}
),

outreach_aggregated as (
    select 
        facility_id,
        month,
        sum(total_outreach) as total_outreach,
        avg(response_rate) as avg_response_rate,
        avg(conversion_rate) as avg_conversion_rate
    from {{ ref('outreach_kpis') }}
    group by facility_id, month
),

combined as (
    select 
        p.facility_id,
        p.month,
        p.total_applications,
        p.hired_count,
        p.avg_time_to_fill_days,
        coalesce(c.compliant_applications, 0) as compliant_applications,
        coalesce(c.compliance_rate, 0) as compliance_rate,
        coalesce(c.violation_count, 0) as violation_count,
        coalesce(r.total_revenue, 0) as total_revenue,
        coalesce(r.avg_revenue_per_invoice, 0) as avg_revenue_per_invoice,
        coalesce(o.total_outreach, 0) as total_outreach,
        coalesce(o.avg_response_rate, 0) as avg_response_rate,
        coalesce(o.avg_conversion_rate, 0) as avg_conversion_rate,
        current_timestamp as dbt_updated_at
    from pipeline p
    left join compliance c 
        on p.facility_id = c.facility_id 
        and p.month = c.month
    left join revenue r 
        on p.facility_id = r.facility_id 
        and p.month = r.month
    left join outreach_aggregated o 
        on p.facility_id = o.facility_id 
        and p.month = o.month
)

select 
    facility_id,
    month,
    total_applications,
    hired_count,
    avg_time_to_fill_days,
    compliant_applications,
    compliance_rate,
    violation_count,
    total_revenue,
    avg_revenue_per_invoice,
    total_outreach,
    avg_response_rate,
    avg_conversion_rate,
    dbt_updated_at
from combined
order by facility_id, month desc
{{--
  Ticket SLA Compliance KPI Model
  Tracks support ticket SLA performance and response times
--}}

with tickets as (
    select 
        facility_id,
        priority,
        status,
        created_at,
        resolved_at,
        first_response_at,
        sla_met,
        date_trunc('month', created_at) as month,
        case 
            when first_response_at is not null 
            then datediff('hour', created_at, first_response_at) 
            else null 
        end as first_response_hours,
        case 
            when resolved_at is not null 
            then datediff('hour', created_at, resolved_at) 
            else null 
        end as resolution_hours
    from {{ source('raw', 'tickets') }}
    where created_at >= dateadd('month', -12, current_date)
),

sla_targets as (
    select 'critical' as priority, 1 as response_hours, 4 as resolution_hours
    union all select 'high', 2, 24
    union all select 'medium', 4, 72
    union all select 'low', 8, 120
),

tickets_with_sla as (
    select 
        t.facility_id,
        t.priority,
        t.month,
        count(*) as total_tickets,
        count(case when status = 'resolved' then 1 end) as resolved_tickets,
        count(case when sla_met = true then 1 end) as sla_compliant_tickets,
        avg(first_response_hours) as avg_first_response_hours,
        avg(resolution_hours) as avg_resolution_hours,
        max(first_response_hours) as max_first_response_hours,
        max(resolution_hours) as max_resolution_hours,
        percentile_cont(0.5) within group (
            order by first_response_hours
        ) as median_first_response_hours,
        percentile_cont(0.5) within group (
            order by resolution_hours
        ) as median_resolution_hours,
        s.response_hours as sla_response_target,
        s.resolution_hours as sla_resolution_target
    from tickets t
    left join sla_targets s on t.priority = s.priority
    group by 
        t.facility_id, t.priority, t.month,
        s.response_hours, s.resolution_hours
)

select 
    facility_id,
    priority,
    month,
    total_tickets,
    resolved_tickets,
    sla_compliant_tickets,
    round(
        (sla_compliant_tickets * 100.0 / nullif(total_tickets, 0)), 2
    ) as sla_compliance_rate_pct,
    round(avg_first_response_hours, 2) as avg_first_response_hours,
    round(avg_resolution_hours, 2) as avg_resolution_hours,
    round(max_first_response_hours, 2) as max_first_response_hours,
    round(max_resolution_hours, 2) as max_resolution_hours,
    round(median_first_response_hours, 2) as median_first_response_hours,
    round(median_resolution_hours, 2) as median_resolution_hours,
    sla_response_target,
    sla_resolution_target,
    current_timestamp as dbt_updated_at
from tickets_with_sla
order by facility_id, month desc, priority

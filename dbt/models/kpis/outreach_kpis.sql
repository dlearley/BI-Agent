{{--
  Outreach KPIs Model
  Calculates outreach effectiveness metrics by channel
--}}

with outreach as (
    select 
        facility_id,
        channel,
        response_received,
        converted,
        created_at,
        date_trunc('month', created_at) as month
    from {{ source('raw', 'outreach') }}
    where created_at >= dateadd('month', -12, current_date)
),

outreach_metrics as (
    select 
        facility_id,
        channel,
        month,
        count(*) as total_outreach,
        count(case when response_received = true then 1 end) as responses,
        count(case when converted = true then 1 end) as conversions
    from outreach
    group by facility_id, channel, month
)

select 
    facility_id,
    channel,
    month,
    total_outreach,
    responses,
    conversions,
    round(
        (responses * 100.0 / nullif(total_outreach, 0)), 2
    ) as response_rate,
    round(
        (conversions * 100.0 / nullif(total_outreach, 0)), 2
    ) as conversion_rate,
    current_timestamp as dbt_updated_at
from outreach_metrics
order by facility_id, channel, month desc
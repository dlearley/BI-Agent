{{--
  Rep Activity by Channel KPI Model
  Tracks sales representative activity and effectiveness by outreach channel
--}}

with outreach_with_rep as (
    select 
        facility_id,
        channel,
        response_received,
        converted,
        sent_at,
        date_trunc('month', sent_at) as month
    from {{ source('raw', 'outreach') }}
    where sent_at >= dateadd('month', -12, current_date)
),

lead_outreach_mapping as (
    select 
        l.rep_id,
        o.facility_id,
        o.channel,
        o.month,
        count(distinct o.id) as total_outreach,
        count(case when o.response_received = true then 1 end) as total_responses,
        count(case when o.converted = true then 1 end) as total_conversions
    from {{ source('raw', 'outreach') }} o
    left join {{ source('raw', 'leads') }} l 
        on o.candidate_id = l.id
        and o.sent_at between l.created_at and l.updated_at
    where o.sent_at >= dateadd('month', -12, current_date)
    group by l.rep_id, o.facility_id, o.channel, o.month
),

channel_metrics as (
    select 
        coalesce(rep_id, 'unassigned') as rep_id,
        facility_id,
        channel,
        month,
        sum(total_outreach) as total_outreach,
        sum(total_responses) as total_responses,
        sum(total_conversions) as total_conversions,
        round(
            (sum(total_responses) * 100.0 / nullif(sum(total_outreach), 0)), 2
        ) as response_rate_pct,
        round(
            (sum(total_conversions) * 100.0 / nullif(sum(total_outreach), 0)), 2
        ) as conversion_rate_pct,
        round(
            (sum(total_conversions) * 100.0 / nullif(sum(total_responses), 0)), 2
        ) as conversion_from_responses_pct
    from lead_outreach_mapping
    group by rep_id, facility_id, channel, month
),

channel_performance as (
    select 
        rep_id,
        facility_id,
        channel,
        month,
        total_outreach,
        total_responses,
        total_conversions,
        response_rate_pct,
        conversion_rate_pct,
        conversion_from_responses_pct,
        rank() over (
            partition by rep_id, facility_id, month 
            order by conversion_rate_pct desc nulls last
        ) as channel_effectiveness_rank
    from channel_metrics
)

select 
    rep_id,
    facility_id,
    channel,
    month,
    total_outreach,
    total_responses,
    total_conversions,
    response_rate_pct,
    conversion_rate_pct,
    conversion_from_responses_pct,
    channel_effectiveness_rank,
    current_timestamp as dbt_updated_at
from channel_performance
order by facility_id, rep_id, month desc, channel_effectiveness_rank

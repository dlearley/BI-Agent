{{--
  Fact table for customer/sales activities
  Grain: One row per activity
--}}

with stg_activities as (
    select * from {{ ref('stg_crm_activities') }}
),

activities_enriched as (
    select 
        a.activity_id,
        a.organization_id,
        a.account_id,
        a.contact_id,
        a.deal_id,
        a.activity_type,
        a.subject,
        a.activity_date,
        date(a.activity_date) as activity_date_key,
        extract(year from a.activity_date) as activity_year,
        extract(quarter from a.activity_date) as activity_quarter,
        extract(month from a.activity_date) as activity_month,
        extract(week from a.activity_date) as activity_week,
        extract(dow from a.activity_date) as activity_day_of_week,
        a.duration_minutes,
        a.outcome,
        a.assigned_to,
        a.completed,
        case 
            when a.completed = true then 'Completed'
            when a.activity_date < current_timestamp then 'Overdue'
            else 'Pending'
        end as activity_status,
        case 
            when a.outcome ilike '%success%' or a.outcome ilike '%positive%' then 'Positive'
            when a.outcome ilike '%negative%' or a.outcome ilike '%failed%' then 'Negative'
            else 'Neutral'
        end as outcome_sentiment,
        a.created_at,
        a.updated_at,
        current_timestamp as dw_updated_at
    from stg_activities a
)

select * from activities_enriched

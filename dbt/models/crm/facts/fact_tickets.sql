{{--
  Fact table for support tickets
  Grain: One row per ticket
--}}

with stg_tickets as (
    select * from {{ ref('stg_crm_tickets') }}
),

tickets_enriched as (
    select 
        t.ticket_id,
        t.organization_id,
        t.account_id,
        t.contact_id,
        t.ticket_number,
        t.subject,
        t.priority,
        t.status,
        t.category,
        t.assigned_to,
        t.created_at as ticket_created_at,
        date(t.created_at) as ticket_created_date,
        extract(year from t.created_at) as ticket_year,
        extract(quarter from t.created_at) as ticket_quarter,
        extract(month from t.created_at) as ticket_month,
        t.updated_at as ticket_updated_at,
        t.resolved_at,
        t.closed_at,
        t.days_to_resolution,
        t.days_to_close,
        t.is_resolved,
        case 
            when t.status = 'closed' then 'Closed'
            when t.status = 'resolved' then 'Resolved'
            when t.status = 'in_progress' then 'In Progress'
            when t.status = 'waiting' then 'Waiting'
            else 'Open'
        end as ticket_state,
        case 
            when t.priority = 'urgent' then 4
            when t.priority = 'high' then 3
            when t.priority = 'medium' then 2
            when t.priority = 'low' then 1
            else 0
        end as priority_score,
        -- SLA calculations (assuming 24h for urgent, 48h for high, 72h for medium, 168h for low)
        case 
            when t.priority = 'urgent' and (t.days_to_resolution is null or t.days_to_resolution <= 1) then 'Met'
            when t.priority = 'urgent' and t.days_to_resolution > 1 then 'Breached'
            when t.priority = 'high' and (t.days_to_resolution is null or t.days_to_resolution <= 2) then 'Met'
            when t.priority = 'high' and t.days_to_resolution > 2 then 'Breached'
            when t.priority = 'medium' and (t.days_to_resolution is null or t.days_to_resolution <= 3) then 'Met'
            when t.priority = 'medium' and t.days_to_resolution > 3 then 'Breached'
            when t.priority = 'low' and (t.days_to_resolution is null or t.days_to_resolution <= 7) then 'Met'
            when t.priority = 'low' and t.days_to_resolution > 7 then 'Breached'
            else 'Unknown'
        end as sla_status,
        current_timestamp as dw_updated_at
    from stg_tickets t
)

select * from tickets_enriched

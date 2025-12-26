{{--
  Staging model for support tickets
  Cleans and prepares ticket data for fact modeling
--}}

with source as (
    select * from {{ source('raw', 'tickets') }}
),

renamed as (
    select 
        id as ticket_id,
        organization_id,
        account_id,
        contact_id,
        ticket_number,
        subject,
        description,
        priority,
        status,
        category,
        assigned_to,
        resolution,
        created_at,
        updated_at,
        resolved_at,
        closed_at,
        case 
            when resolved_at is not null 
            then extract(epoch from (resolved_at - created_at)) / 86400.0
            else null 
        end as days_to_resolution,
        case 
            when closed_at is not null 
            then extract(epoch from (closed_at - created_at)) / 86400.0
            else null 
        end as days_to_close,
        case 
            when status in ('resolved', 'closed') 
            then true 
            else false 
        end as is_resolved
    from source
)

select * from renamed

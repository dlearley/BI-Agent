{{--
  Staging model for support tickets
  Cleans and prepares tickets data for SLA compliance tracking
--}}

with source as (
    select * from {{ source('raw', 'tickets') }}
),

renamed as (
    select 
        id as ticket_id,
        facility_id,
        priority,
        status,
        created_at,
        resolved_at,
        first_response_at,
        sla_met,
        date_trunc('month', created_at) as month
    from source
)

select * from renamed

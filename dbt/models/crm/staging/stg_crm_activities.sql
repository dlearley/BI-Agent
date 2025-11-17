{{--
  Staging model for activities
  Cleans and prepares activity data for fact modeling
--}}

with source as (
    select * from {{ source('raw', 'activities') }}
),

renamed as (
    select 
        id as activity_id,
        organization_id,
        account_id,
        contact_id,
        deal_id,
        activity_type,
        subject,
        description,
        activity_date,
        duration_minutes,
        outcome,
        assigned_to,
        completed,
        created_at,
        updated_at
    from source
)

select * from renamed

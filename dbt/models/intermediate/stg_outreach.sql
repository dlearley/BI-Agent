{{--
  Staging model for outreach data
  Cleans and prepares outreach data for analytics
--}}

with source as (
    select * from {{ source('raw', 'outreach') }}
),

renamed as (
    select 
        id as outreach_id,
        facility_id,
        candidate_id,
        channel,
        message,
        sent_at,
        response_received,
        responded_at,
        converted,
        created_at,
        updated_at
    from source
)

select * from renamed
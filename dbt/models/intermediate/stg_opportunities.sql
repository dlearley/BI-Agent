{{--
  Staging model for opportunities data
  Cleans and prepares opportunities data for analytics
--}}

with source as (
    select * from {{ source('raw', 'opportunities') }}
),

renamed as (
    select 
        id as opportunity_id,
        lead_id,
        rep_id,
        status,
        created_at,
        updated_at,
        closed_at,
        amount
    from source
)

select * from renamed

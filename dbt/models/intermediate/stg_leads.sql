{{--
  Staging model for leads data
  Cleans and prepares leads data for analytics
--}}

with source as (
    select * from {{ source('raw', 'leads') }}
),

renamed as (
    select 
        id as lead_id,
        facility_id,
        rep_id,
        status,
        stage,
        created_at,
        updated_at,
        qualified_at,
        closed_at,
        amount,
        created_month,
        date_trunc('month', created_at) as cohort_month
    from source
)

select * from renamed

{{--
  Staging model for applications data
  Cleans and prepares applications data for analytics
--}}

with source as (
    select * from {{ source('raw', 'applications') }}
),

renamed as (
    select 
        id as application_id,
        facility_id,
        candidate_id,
        status,
        created_at,
        updated_at,
        hired_at,
        compliance_score,
        has_violations,
        source
    from source
)

select * from renamed
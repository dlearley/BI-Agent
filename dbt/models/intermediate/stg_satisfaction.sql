{{--
  Staging model for satisfaction survey data
  Cleans and prepares CSAT/NPS data for analytics
--}}

with source as (
    select * from {{ source('raw', 'satisfaction') }}
),

renamed as (
    select 
        id as satisfaction_id,
        facility_id,
        survey_type,
        score,
        created_at,
        feedback,
        date_trunc('month', created_at) as month
    from source
)

select * from renamed

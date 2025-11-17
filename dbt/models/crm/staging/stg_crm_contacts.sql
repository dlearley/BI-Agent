{{--
  Staging model for CRM contacts
  Cleans and prepares contact data for dimensional modeling
--}}

with source as (
    select * from {{ source('raw', 'contacts') }}
),

renamed as (
    select 
        id as contact_id,
        organization_id,
        account_id,
        first_name,
        last_name,
        first_name || ' ' || last_name as full_name,
        email,
        phone,
        job_title,
        department,
        is_primary,
        contact_status,
        created_at,
        updated_at
    from source
)

select * from renamed

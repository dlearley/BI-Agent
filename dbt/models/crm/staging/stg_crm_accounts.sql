{{--
  Staging model for CRM accounts
  Cleans and prepares account data for dimensional modeling
--}}

with source as (
    select * from {{ source('raw', 'accounts') }}
),

renamed as (
    select 
        id as account_id,
        organization_id,
        name as account_name,
        industry,
        company_size,
        annual_revenue,
        website,
        phone,
        billing_address,
        shipping_address,
        account_owner,
        account_status,
        created_at,
        updated_at
    from source
)

select * from renamed

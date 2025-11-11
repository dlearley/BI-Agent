{{--
  Staging model for invoices data
  Cleans and prepares invoices data for analytics
--}}

with source as (
    select * from {{ source('raw', 'invoices') }}
),

renamed as (
    select 
        id as invoice_id,
        facility_id,
        application_id,
        amount,
        status,
        created_at,
        updated_at,
        paid_at
    from source
)

select * from renamed
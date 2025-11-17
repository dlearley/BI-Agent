{{--
  Staging model for orders
  Cleans and prepares order data for fact modeling
--}}

with source as (
    select * from {{ source('raw', 'orders') }}
),

renamed as (
    select 
        id as order_id,
        organization_id,
        customer_id,
        order_number,
        status as order_status,
        subtotal,
        tax,
        shipping,
        total as order_total,
        payment_method,
        created_at as order_date,
        updated_at,
        shipped_at,
        delivered_at,
        case 
            when delivered_at is not null 
            then extract(epoch from (delivered_at - created_at)) / 86400.0
            else null 
        end as days_to_delivery,
        case 
            when status in ('delivered', 'shipped') 
            then true 
            else false 
        end as is_fulfilled
    from source
)

select * from renamed

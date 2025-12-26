{{--
  Staging model for products
  Cleans and prepares product data for dimensional modeling
--}}

with source as (
    select * from {{ source('raw', 'products') }}
),

renamed as (
    select 
        id as product_id,
        organization_id,
        name as product_name,
        sku,
        category,
        price,
        cost,
        inventory_quantity,
        case 
            when cost is not null and cost > 0 
            then ((price - cost) / cost) * 100 
            else null 
        end as margin_percentage,
        created_at,
        updated_at
    from source
)

select * from renamed

{{--
  Dimension table for products
  Type 1 SCD - overwrites with latest data
--}}

with stg_products as (
    select * from {{ ref('stg_crm_products') }}
),

products_enriched as (
    select 
        product_id,
        organization_id,
        product_name,
        sku,
        category,
        price,
        cost,
        price - coalesce(cost, 0) as profit_per_unit,
        margin_percentage,
        inventory_quantity,
        case 
            when inventory_quantity <= 0 then 'Out of Stock'
            when inventory_quantity < 10 then 'Low Stock'
            when inventory_quantity < 50 then 'Normal Stock'
            else 'High Stock'
        end as inventory_status,
        case 
            when price < 50 then 'Budget'
            when price < 200 then 'Mid-Range'
            when price < 500 then 'Premium'
            else 'Luxury'
        end as price_tier,
        created_at,
        updated_at,
        current_timestamp as dw_updated_at
    from stg_products
)

select * from products_enriched

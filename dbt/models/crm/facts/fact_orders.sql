{{--
  Fact table for orders
  Grain: One row per order
--}}

with stg_orders as (
    select * from {{ ref('stg_crm_orders') }}
),

orders_enriched as (
    select 
        o.order_id,
        o.organization_id,
        o.customer_id,
        o.order_number,
        o.order_status,
        o.subtotal,
        o.tax,
        o.shipping,
        o.order_total,
        o.payment_method,
        o.order_date,
        date(o.order_date) as order_date_key,
        extract(year from o.order_date) as order_year,
        extract(quarter from o.order_date) as order_quarter,
        extract(month from o.order_date) as order_month,
        extract(week from o.order_date) as order_week,
        extract(dow from o.order_date) as order_day_of_week,
        o.updated_at as order_updated_at,
        o.shipped_at,
        o.delivered_at,
        o.days_to_delivery,
        o.is_fulfilled,
        case 
            when o.order_status = 'delivered' then 'Completed'
            when o.order_status = 'shipped' then 'In Transit'
            when o.order_status in ('processing', 'pending') then 'Processing'
            when o.order_status = 'cancelled' then 'Cancelled'
            when o.order_status = 'refunded' then 'Refunded'
            else 'Unknown'
        end as order_state,
        case 
            when o.order_status in ('cancelled', 'refunded') then 0
            else o.order_total
        end as revenue_amount,
        case 
            when o.order_status in ('cancelled', 'refunded') then 0
            else 1
        end as order_count_metric,
        -- Calculate tax rate
        case 
            when o.subtotal > 0 
            then (o.tax / o.subtotal) * 100 
            else 0 
        end as tax_rate_percentage,
        current_timestamp as dw_updated_at
    from stg_orders o
)

select * from orders_enriched

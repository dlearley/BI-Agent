{{--
  Revenue KPIs Model
  Calculates revenue metrics from invoices data
--}}

with invoices as (
    select 
        facility_id,
        amount,
        status,
        created_at,
        date_trunc('month', created_at) as month
    from {{ source('raw', 'invoices') }}
    where created_at >= dateadd('month', -12, current_date)
        and status = 'paid'
),

revenue_metrics as (
    select 
        facility_id,
        month,
        count(*) as total_invoices,
        sum(amount) as total_revenue,
        avg(amount) as avg_revenue_per_invoice
    from invoices
    group by facility_id, month
)

select 
    facility_id,
    month,
    total_invoices,
    round(total_revenue, 2) as total_revenue,
    round(avg_revenue_per_invoice, 2) as avg_revenue_per_invoice,
    current_timestamp as dbt_updated_at
from revenue_metrics
order by facility_id, month desc
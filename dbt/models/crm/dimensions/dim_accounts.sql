{{--
  Dimension table for accounts
  Type 1 SCD - overwrites with latest data
--}}

with stg_accounts as (
    select * from {{ ref('stg_crm_accounts') }}
),

accounts_enriched as (
    select 
        account_id,
        organization_id,
        account_name,
        industry,
        company_size,
        annual_revenue,
        website,
        phone,
        billing_address,
        shipping_address,
        account_owner,
        account_status,
        case 
            when account_status in ('customer', 'active') then 'Customer'
            when account_status = 'prospect' then 'Prospect'
            when account_status = 'churned' then 'Churned'
            else 'Inactive'
        end as account_category,
        case 
            when annual_revenue is null then 'Unknown'
            when annual_revenue < 1000000 then 'Small'
            when annual_revenue < 10000000 then 'Medium'
            when annual_revenue < 100000000 then 'Large'
            else 'Enterprise'
        end as revenue_segment,
        created_at,
        updated_at,
        current_timestamp as dw_updated_at
    from stg_accounts
)

select * from accounts_enriched

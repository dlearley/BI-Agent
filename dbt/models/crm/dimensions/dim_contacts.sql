{{--
  Dimension table for contacts
  Type 1 SCD - overwrites with latest data
--}}

with stg_contacts as (
    select * from {{ ref('stg_crm_contacts') }}
),

stg_accounts as (
    select * from {{ ref('stg_crm_accounts') }}
),

contacts_enriched as (
    select 
        c.contact_id,
        c.organization_id,
        c.account_id,
        a.account_name,
        c.first_name,
        c.last_name,
        c.full_name,
        c.email,
        c.phone,
        c.job_title,
        c.department,
        c.is_primary,
        c.contact_status,
        case 
            when c.contact_status = 'active' then 'Active'
            when c.contact_status = 'inactive' then 'Inactive'
            when c.contact_status = 'unsubscribed' then 'Unsubscribed'
            else 'Unknown'
        end as contact_category,
        case 
            when c.job_title ilike '%ceo%' or c.job_title ilike '%chief executive%' then 'C-Level'
            when c.job_title ilike '%cto%' or c.job_title ilike '%cfo%' or c.job_title ilike '%coo%' then 'C-Level'
            when c.job_title ilike '%vp%' or c.job_title ilike '%vice president%' then 'VP'
            when c.job_title ilike '%director%' then 'Director'
            when c.job_title ilike '%manager%' then 'Manager'
            else 'Individual Contributor'
        end as seniority_level,
        c.created_at,
        c.updated_at,
        current_timestamp as dw_updated_at
    from stg_contacts c
    left join stg_accounts a on c.account_id = a.account_id
)

select * from contacts_enriched

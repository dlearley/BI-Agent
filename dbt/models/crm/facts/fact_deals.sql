{{--
  Fact table for deals/opportunities
  Grain: One row per deal with current state
--}}

with stg_deals as (
    select * from {{ ref('stg_crm_deals') }}
),

deal_stage_history as (
    select * from {{ source('raw', 'deal_stage_history') }}
),

deal_metrics as (
    select 
        d.deal_id,
        d.organization_id,
        d.account_id,
        d.contact_id,
        d.deal_name,
        d.deal_amount,
        d.current_stage,
        d.probability,
        d.expected_close_date,
        d.actual_close_date,
        d.deal_owner,
        d.lead_source,
        d.is_closed,
        d.is_won,
        d.is_overdue,
        d.created_at as deal_created_at,
        d.updated_at as deal_updated_at,
        -- Calculate days in pipeline
        case 
            when d.actual_close_date is not null 
            then extract(epoch from (d.actual_close_date - d.created_at)) / 86400.0
            else extract(epoch from (current_timestamp - d.created_at)) / 86400.0
        end as days_in_pipeline,
        -- Calculate weighted value
        (d.deal_amount * coalesce(d.probability, 0)) / 100.0 as weighted_amount,
        -- Count stage changes
        (select count(*) from deal_stage_history h where h.deal_id = d.deal_id) as stage_change_count,
        -- Get first stage entry date
        (select min(changed_at) from deal_stage_history h where h.deal_id = d.deal_id) as first_stage_change,
        -- Get latest stage entry date
        (select max(changed_at) from deal_stage_history h where h.deal_id = d.deal_id) as latest_stage_change,
        current_timestamp as dw_updated_at
    from stg_deals d
)

select * from deal_metrics

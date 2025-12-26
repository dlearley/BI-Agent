{{--
  Fact table for deal stage history
  Type 2 SCD - tracks all stage changes over time
  Grain: One row per stage change per deal
--}}

with deal_stage_history as (
    select * from {{ source('raw', 'deal_stage_history') }}
),

stg_deals as (
    select * from {{ ref('stg_crm_deals') }}
),

stage_history_enriched as (
    select 
        h.id as history_id,
        h.deal_id,
        d.organization_id,
        d.account_id,
        d.contact_id,
        d.deal_name,
        d.deal_amount,
        d.deal_owner,
        h.stage as current_stage,
        h.previous_stage,
        h.changed_at,
        h.changed_by,
        h.days_in_stage,
        h.notes,
        -- Calculate stage progression metrics
        case 
            when h.previous_stage is null then 'Initial'
            when h.previous_stage = 'prospecting' and h.stage = 'qualification' then 'Forward'
            when h.previous_stage = 'qualification' and h.stage = 'proposal' then 'Forward'
            when h.previous_stage = 'proposal' and h.stage = 'negotiation' then 'Forward'
            when h.previous_stage = 'negotiation' and h.stage in ('closed_won', 'closed_lost') then 'Forward'
            when h.stage in ('closed_won', 'closed_lost') then 'Closed'
            else 'Backward'
        end as stage_movement,
        -- Stage order for analysis
        case h.stage
            when 'prospecting' then 1
            when 'qualification' then 2
            when 'proposal' then 3
            when 'negotiation' then 4
            when 'closed_won' then 5
            when 'closed_lost' then 6
            else 0
        end as stage_order,
        case h.previous_stage
            when 'prospecting' then 1
            when 'qualification' then 2
            when 'proposal' then 3
            when 'negotiation' then 4
            when 'closed_won' then 5
            when 'closed_lost' then 6
            else 0
        end as previous_stage_order,
        current_timestamp as dw_updated_at
    from deal_stage_history h
    left join stg_deals d on h.deal_id = d.deal_id
)

select * from stage_history_enriched

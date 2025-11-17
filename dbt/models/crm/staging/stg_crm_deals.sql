{{--
  Staging model for deals
  Cleans and prepares deal/opportunity data for fact modeling
--}}

with source as (
    select * from {{ source('raw', 'deals') }}
),

renamed as (
    select 
        id as deal_id,
        organization_id,
        account_id,
        contact_id,
        name as deal_name,
        amount as deal_amount,
        stage as current_stage,
        probability,
        expected_close_date,
        actual_close_date,
        deal_owner,
        lead_source,
        description,
        case 
            when stage in ('closed_won', 'closed_lost') 
            then true 
            else false 
        end as is_closed,
        case 
            when stage = 'closed_won' 
            then true 
            else false 
        end as is_won,
        case 
            when expected_close_date < current_date and stage not in ('closed_won', 'closed_lost')
            then true 
            else false 
        end as is_overdue,
        created_at,
        updated_at
    from source
)

select * from renamed

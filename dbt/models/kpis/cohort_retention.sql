{{--
  Cohort Retention KPI Model
  Tracks lead cohort retention and progression through months
--}}

with leads_with_cohort as (
    select 
        id as lead_id,
        facility_id,
        rep_id,
        stage,
        status,
        created_at,
        closed_at,
        date_trunc('month', created_at) as cohort_month,
        date_trunc('month', updated_at) as activity_month
    from {{ source('raw', 'leads') }}
    where created_at >= dateadd('month', -12, current_date)
),

cohort_with_age as (
    select 
        lead_id,
        facility_id,
        rep_id,
        cohort_month,
        activity_month,
        stage,
        status,
        datediff('month', cohort_month, activity_month) as months_since_cohort,
        case 
            when status = 'won' then 1 
            when status = 'lost' then 0 
            else 0.5 
        end as status_weight
    from leads_with_cohort
),

cohort_retention_matrix as (
    select 
        facility_id,
        rep_id,
        cohort_month,
        months_since_cohort,
        count(distinct lead_id) as leads_in_cohort,
        sum(status_weight) as weighted_active_leads,
        count(case when stage in ('opportunity', 'won') then 1 end) as progressed_leads,
        round(
            (count(distinct lead_id) * 100.0 / 
            nullif(
                count(distinct lead_id) over (
                    partition by facility_id, rep_id, cohort_month
                ), 0
            )), 2
        ) as retention_rate_pct,
        round(
            (count(case when stage in ('opportunity', 'won') then 1 end) * 100.0 / 
            nullif(count(distinct lead_id), 0)), 2
        ) as progression_rate_pct
    from cohort_with_age
    where months_since_cohort >= 0
        and months_since_cohort <= 11
    group by 
        facility_id, rep_id, cohort_month, months_since_cohort
)

select 
    facility_id,
    rep_id,
    cohort_month,
    months_since_cohort,
    leads_in_cohort,
    weighted_active_leads,
    progressed_leads,
    retention_rate_pct,
    progression_rate_pct,
    current_timestamp as dbt_updated_at
from cohort_retention_matrix
order by facility_id, rep_id, cohort_month desc, months_since_cohort

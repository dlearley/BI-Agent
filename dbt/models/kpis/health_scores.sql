{{--
  Health Scores KPI Model
  Comprehensive health scoring combining multiple KPIs
--}}

with monthly_kpis as (
    select 
        facility_id,
        month,
        round(avg(compliance_rate), 2) as compliance_score,
        null::numeric as pipeline_score,
        null::numeric as conversion_score,
        null::numeric as sla_score,
        null::numeric as satisfaction_score
    from {{ ref('compliance_kpis') }}
    group by facility_id, month
),

pipeline_metrics as (
    select 
        facility_id,
        month,
        round(
            case 
                when sum(total_applications) > 0 
                then (sum(total_applications) - avg(pending_count)) * 100.0 / 
                     nullif(sum(total_applications), 0)
                else 50
            end, 2
        ) as pipeline_health
    from {{ ref('pipeline_kpis') }}
    where month is not null
    group by facility_id, month
),

conversion_health as (
    select 
        facility_id,
        month,
        round(
            case 
                when sum(stage_count) > 0 
                then (count(case when funnel_stage = 'won' then 1 end) * 100.0) / 
                     nullif(sum(stage_count), 0)
                else 0
            end, 2
        ) as conversion_health
    from {{ ref('conversion_funnel') }}
    where month is not null
    group by facility_id, month
),

sla_health as (
    select 
        facility_id,
        month,
        round(avg(sla_compliance_rate_pct), 2) as sla_health
    from {{ ref('ticket_sla_compliance') }}
    where month is not null
    group by facility_id, month
),

satisfaction_health as (
    select 
        facility_id,
        month,
        round(
            case 
                when metric_type = 'csat' 
                then avg(promoter_or_satisfaction_pct)
                else avg(promoter_or_satisfaction_pct)
            end, 2
        ) as satisfaction_health
    from {{ ref('satisfaction_rollups') }}
    where month is not null
    group by facility_id, month
),

combined_health as (
    select 
        coalesce(
            mk.facility_id, 
            pm.facility_id, 
            ch.facility_id, 
            sh.facility_id, 
            sah.facility_id
        ) as facility_id,
        coalesce(
            mk.month, 
            pm.month, 
            ch.month, 
            sh.month, 
            sah.month
        ) as month,
        coalesce(mk.compliance_score, 50) as compliance_score,
        coalesce(pm.pipeline_health, 50) as pipeline_health,
        coalesce(ch.conversion_health, 50) as conversion_health,
        coalesce(sh.sla_health, 50) as sla_health,
        coalesce(sah.satisfaction_health, 50) as satisfaction_health
    from monthly_kpis mk
    full outer join pipeline_metrics pm 
        on mk.facility_id = pm.facility_id 
        and mk.month = pm.month
    full outer join conversion_health ch 
        on mk.facility_id = ch.facility_id 
        and mk.month = ch.month
    full outer join sla_health sh 
        on mk.facility_id = sh.facility_id 
        and mk.month = sh.month
    full outer join satisfaction_health sah 
        on mk.facility_id = sah.facility_id 
        and mk.month = sah.month
)

select 
    facility_id,
    month,
    compliance_score,
    pipeline_health,
    conversion_health,
    sla_health,
    satisfaction_health,
    round(
        (compliance_score + pipeline_health + conversion_health + sla_health + satisfaction_health) / 5.0, 
        2
    ) as overall_health_score,
    case 
        when (compliance_score + pipeline_health + conversion_health + sla_health + satisfaction_health) / 5.0 >= 80 
        then 'excellent'
        when (compliance_score + pipeline_health + conversion_health + sla_health + satisfaction_health) / 5.0 >= 60 
        then 'good'
        when (compliance_score + pipeline_health + conversion_health + sla_health + satisfaction_health) / 5.0 >= 40 
        then 'fair'
        else 'poor'
    end as health_status,
    current_timestamp as dbt_updated_at
from combined_health
where month is not null
order by facility_id, month desc

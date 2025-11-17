{% snapshot health_score_snapshot %}

    {{
        config(
            target_schema='analytics',
            unique_key=['facility_id', 'month'],
            strategy='timestamp',
            updated_at='dbt_updated_at'
        )
    }}

    select 
        facility_id,
        month,
        compliance_score,
        pipeline_health,
        conversion_health,
        sla_health,
        satisfaction_health,
        overall_health_score,
        health_status,
        dbt_updated_at
    from {{ ref('health_scores') }}

{% endsnapshot %}

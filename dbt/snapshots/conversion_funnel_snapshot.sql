{% snapshot conversion_funnel_snapshot %}

    {{
        config(
            target_schema='analytics',
            unique_key=['facility_id', 'rep_id', 'month', 'funnel_stage'],
            strategy='timestamp',
            updated_at='dbt_updated_at'
        )
    }}

    select 
        facility_id,
        rep_id,
        month,
        funnel_stage,
        stage_count,
        previous_stage_count,
        conversion_rate_pct,
        dbt_updated_at
    from {{ ref('conversion_funnel') }}

{% endsnapshot %}

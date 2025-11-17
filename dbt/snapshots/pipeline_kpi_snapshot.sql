{% snapshot pipeline_kpi_snapshot %}

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
        total_applications,
        hired_count,
        rejected_count,
        pending_count,
        interview_count,
        avg_time_to_fill_days,
        dbt_updated_at
    from {{ ref('pipeline_kpis') }}

{% endsnapshot %}

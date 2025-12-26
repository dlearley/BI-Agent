-- Custom data quality tests for anomaly detection

-- Check for unusually high or low application counts
-- This test fails if monthly applications deviate by more than 3 standard deviations
with monthly_stats as (
    select 
        facility_id,
        month,
        total_applications,
        avg(total_applications) over (partition by facility_id) as avg_apps,
        stddev(total_applications) over (partition by facility_id) as stddev_apps
    from {{ ref('pipeline_kpis') }}
),
anomalies as (
    select 
        facility_id,
        month,
        total_applications,
        avg_apps,
        stddev_apps,
        case 
            when stddev_apps > 0 and abs(total_applications - avg_apps) > 3 * stddev_apps then true
            else false
        end as is_anomaly
    from monthly_stats
)
select * from anomalies where is_anomaly = true

-- Manual refresh script for analytics materialized views
-- This script provides SQL commands to manually refresh the analytics views
-- Use this when the application's automatic refresh is not working or for debugging

-- Check current status of materialized views
SELECT 
    schemaname,
    matviewname,
    ispopulated,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews 
WHERE schemaname = 'analytics'
ORDER BY matviewname;

-- Refresh all materialized views (non-concurrent)
-- Note: This will lock the views during refresh
DO $$
BEGIN
    RAISE NOTICE 'Refreshing pipeline_kpis_materialized...';
    REFRESH MATERIALIZED VIEW analytics.pipeline_kpis_materialized;
    
    RAISE NOTICE 'Refreshing compliance_kpis_materialized...';
    REFRESH MATERIALIZED VIEW analytics.compliance_kpis_materialized;
    
    RAISE NOTICE 'Refreshing revenue_kpis_materialized...';
    REFRESH MATERIALIZED VIEW analytics.revenue_kpis_materialized;
    
    RAISE NOTICE 'Refreshing outreach_kpis_materialized...';
    REFRESH MATERIALIZED VIEW analytics.outreach_kpis_materialized;
    
    RAISE NOTICE 'All materialized views refreshed successfully!';
END $$;

-- Alternative: Refresh all materialized views concurrently
-- Note: Requires unique indexes and may be slower but doesn't lock
DO $$
BEGIN
    RAISE NOTICE 'Concurrently refreshing pipeline_kpis_materialized...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.pipeline_kpis_materialized;
    
    RAISE NOTICE 'Concurrently refreshing compliance_kpis_materialized...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.compliance_kpis_materialized;
    
    RAISE NOTICE 'Concurrently refreshing revenue_kpis_materialized...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.revenue_kpis_materialized;
    
    RAISE NOTICE 'Concurrently refreshing outreach_kpis_materialized...';
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.outreach_kpis_materialized;
    
    RAISE NOTICE 'All materialized views refreshed concurrently!';
END $$;

-- Refresh specific view (example: pipeline only)
REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.pipeline_kpis_materialized;

-- Check last refresh times using the function
SELECT * FROM analytics.get_last_refresh();

-- Verify data in materialized views
SELECT 'pipeline_kpis_materialized' as view_name, COUNT(*) as row_count FROM analytics.pipeline_kpis_materialized
UNION ALL
SELECT 'compliance_kpis_materialized', COUNT(*) FROM analytics.compliance_kpis_materialized
UNION ALL
SELECT 'revenue_kpis_materialized', COUNT(*) FROM analytics.revenue_kpis_materialized
UNION ALL
SELECT 'outreach_kpis_materialized', COUNT(*) FROM analytics.outreach_kpis_materialized;

-- Sample queries to test the refreshed data
-- Pipeline KPIs
SELECT 
    facility_id,
    SUM(total_applications) as total_applications,
    SUM(hired_count) as hired_count,
    ROUND(AVG(avg_time_to_fill_days), 2) as avg_time_to_fill_days
FROM analytics.pipeline_kpis_materialized
GROUP BY facility_id
ORDER BY facility_id;

-- Compliance metrics
SELECT 
    facility_id,
    SUM(total_applications) as total_applications,
    SUM(compliant_applications) as compliant_applications,
    ROUND(AVG(avg_compliance_score), 2) as avg_compliance_score
FROM analytics.compliance_kpis_materialized
GROUP BY facility_id
ORDER BY facility_id;

-- Revenue metrics
SELECT 
    facility_id,
    SUM(total_revenue) as total_revenue,
    ROUND(AVG(avg_revenue_per_invoice), 2) as avg_revenue_per_invoice
FROM analytics.revenue_kpis_materialized
GROUP BY facility_id
ORDER BY facility_id;

-- Outreach metrics
SELECT 
    facility_id,
    channel,
    SUM(total_outreach) as total_outreach,
    ROUND(AVG(response_rate), 2) as avg_response_rate,
    ROUND(AVG(conversion_rate), 2) as avg_conversion_rate
FROM analytics.outreach_kpis_materialized
GROUP BY facility_id, channel
ORDER BY facility_id, channel;

-- Combined KPIs
SELECT 
    facility_id,
    SUM(total_applications) as total_applications,
    SUM(hired_count) as hired_count,
    ROUND(AVG(avg_time_to_fill_days), 2) as avg_time_to_fill_days,
    ROUND(AVG(compliance_rate), 2) as avg_compliance_rate,
    SUM(total_revenue) as total_revenue,
    SUM(total_outreach) as total_outreach
FROM analytics.combined_kpis
GROUP BY facility_id
ORDER BY facility_id;

-- Check for any errors or issues
-- Verify all required indexes exist
SELECT 
    indexname,
    tablename,
    schemaname
FROM pg_indexes 
WHERE schemaname = 'analytics' 
    AND tablename LIKE '%_materialized'
ORDER BY tablename, indexname;

-- Check for any failed refresh attempts (if using pg_stat_statements)
SELECT 
    query,
    calls,
    total_time,
    mean_time,
    rows
FROM pg_stat_statements 
WHERE query LIKE '%REFRESH MATERIALIZED VIEW%'
ORDER BY total_time DESC
LIMIT 10;
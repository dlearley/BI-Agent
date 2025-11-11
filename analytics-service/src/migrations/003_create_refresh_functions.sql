-- Function to refresh pipeline KPIs materialized view
CREATE OR REPLACE FUNCTION analytics.refresh_pipeline_kpis()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.pipeline_kpis_materialized;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh compliance KPIs materialized view
CREATE OR REPLACE FUNCTION analytics.refresh_compliance_kpis()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.compliance_kpis_materialized;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh revenue KPIs materialized view
CREATE OR REPLACE FUNCTION analytics.refresh_revenue_kpis()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.revenue_kpis_materialized;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh outreach KPIs materialized view
CREATE OR REPLACE FUNCTION analytics.refresh_outreach_kpis()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY analytics.outreach_kpis_materialized;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh all analytics materialized views
CREATE OR REPLACE FUNCTION analytics.refresh_all_analytics()
RETURNS void AS $$
BEGIN
    PERFORM analytics.refresh_pipeline_kpis();
    PERFORM analytics.refresh_compliance_kpis();
    PERFORM analytics.refresh_revenue_kpis();
    PERFORM analytics.refresh_outreach_kpis();
END;
$$ LANGUAGE plpgsql;

-- Function to get last refresh timestamp
CREATE OR REPLACE FUNCTION analytics.get_last_refresh()
RETURNS TABLE(
    view_name text,
    last_updated timestamp
) AS $$
BEGIN
    RETURN QUERY
    SELECT 'pipeline_kpis'::text, MAX(last_updated) 
    FROM analytics.pipeline_kpis_materialized
    UNION ALL
    SELECT 'compliance_kpis'::text, MAX(last_updated) 
    FROM analytics.compliance_kpis_materialized
    UNION ALL
    SELECT 'revenue_kpis'::text, MAX(last_updated) 
    FROM analytics.revenue_kpis_materialized
    UNION ALL
    SELECT 'outreach_kpis'::text, MAX(last_updated) 
    FROM analytics.outreach_kpis_materialized;
END;
$$ LANGUAGE plpgsql;
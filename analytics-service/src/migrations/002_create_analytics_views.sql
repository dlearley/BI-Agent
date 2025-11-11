-- Pipeline Analytics View
CREATE OR REPLACE VIEW analytics.pipeline_kpis AS
SELECT 
    facility_id,
    COUNT(*) as total_applications,
    COUNT(CASE WHEN status = 'hired' THEN 1 END) as hired_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'interview' THEN 1 END) as interview_count,
    ROUND(
        AVG(CASE 
            WHEN status = 'hired' AND hired_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (hired_at - created_at)) / 86400 
        END), 2
    ) as avg_time_to_fill_days,
    DATE_TRUNC('month', created_at) as month
FROM applications
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY facility_id, DATE_TRUNC('month', created_at);

-- Materialized View for Pipeline KPIs (for better performance)
CREATE MATERIALIZED VIEW analytics.pipeline_kpis_materialized AS
SELECT 
    facility_id,
    COUNT(*) as total_applications,
    COUNT(CASE WHEN status = 'hired' THEN 1 END) as hired_count,
    COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_count,
    COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
    COUNT(CASE WHEN status = 'interview' THEN 1 END) as interview_count,
    ROUND(
        AVG(CASE 
            WHEN status = 'hired' AND hired_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (hired_at - created_at)) / 86400 
        END), 2
    ) as avg_time_to_fill_days,
    DATE_TRUNC('month', created_at) as month,
    NOW() as last_updated
FROM applications
WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY facility_id, DATE_TRUNC('month', created_at);

-- Create unique index for concurrent refresh
CREATE UNIQUE INDEX idx_pipeline_kpis_materialized_unique 
ON analytics.pipeline_kpis_materialized (facility_id, month);

-- Compliance Analytics View
CREATE OR REPLACE VIEW analytics.compliance_kpis AS
SELECT 
    a.facility_id,
    COUNT(*) as total_applications,
    COUNT(CASE WHEN a.compliance_score >= 80 THEN 1 END) as compliant_applications,
    ROUND(AVG(a.compliance_score), 2) as avg_compliance_score,
    COUNT(CASE WHEN a.has_violations = true THEN 1 END) as violation_count,
    DATE_TRUNC('month', a.created_at) as month
FROM applications a
WHERE a.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY a.facility_id, DATE_TRUNC('month', a.created_at);

-- Materialized View for Compliance KPIs
CREATE MATERIALIZED VIEW analytics.compliance_kpis_materialized AS
SELECT 
    a.facility_id,
    COUNT(*) as total_applications,
    COUNT(CASE WHEN a.compliance_score >= 80 THEN 1 END) as compliant_applications,
    ROUND(AVG(a.compliance_score), 2) as avg_compliance_score,
    COUNT(CASE WHEN a.has_violations = true THEN 1 END) as violation_count,
    DATE_TRUNC('month', a.created_at) as month,
    NOW() as last_updated
FROM applications a
WHERE a.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY a.facility_id, DATE_TRUNC('month', a.created_at);

CREATE UNIQUE INDEX idx_compliance_kpis_materialized_unique 
ON analytics.compliance_kpis_materialized (facility_id, month);

-- Revenue Analytics View
CREATE OR REPLACE VIEW analytics.revenue_kpis AS
SELECT 
    i.facility_id,
    COUNT(*) as total_invoices,
    SUM(i.amount) as total_revenue,
    ROUND(AVG(i.amount), 2) as avg_revenue_per_invoice,
    DATE_TRUNC('month', i.created_at) as month
FROM invoices i
WHERE i.created_at >= CURRENT_DATE - INTERVAL '12 months'
    AND i.status = 'paid'
GROUP BY i.facility_id, DATE_TRUNC('month', i.created_at);

-- Materialized View for Revenue KPIs
CREATE MATERIALIZED VIEW analytics.revenue_kpis_materialized AS
SELECT 
    i.facility_id,
    COUNT(*) as total_invoices,
    SUM(i.amount) as total_revenue,
    ROUND(AVG(i.amount), 2) as avg_revenue_per_invoice,
    DATE_TRUNC('month', i.created_at) as month,
    NOW() as last_updated
FROM invoices i
WHERE i.created_at >= CURRENT_DATE - INTERVAL '12 months'
    AND i.status = 'paid'
GROUP BY i.facility_id, DATE_TRUNC('month', i.created_at);

CREATE UNIQUE INDEX idx_revenue_kpis_materialized_unique 
ON analytics.revenue_kpis_materialized (facility_id, month);

-- Outreach Analytics View
CREATE OR REPLACE VIEW analytics.outreach_kpis AS
SELECT 
    o.facility_id,
    o.channel,
    COUNT(*) as total_outreach,
    COUNT(CASE WHEN o.response_received = true THEN 1 END) as responses,
    COUNT(CASE WHEN o.converted = true THEN 1 END) as conversions,
    ROUND(
        COUNT(CASE WHEN o.response_received = true THEN 1 END) * 100.0 / COUNT(*), 2
    ) as response_rate,
    ROUND(
        COUNT(CASE WHEN o.converted = true THEN 1 END) * 100.0 / COUNT(*), 2
    ) as conversion_rate,
    DATE_TRUNC('month', o.created_at) as month
FROM outreach o
WHERE o.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY o.facility_id, o.channel, DATE_TRUNC('month', o.created_at);

-- Materialized View for Outreach KPIs
CREATE MATERIALIZED VIEW analytics.outreach_kpis_materialized AS
SELECT 
    o.facility_id,
    o.channel,
    COUNT(*) as total_outreach,
    COUNT(CASE WHEN o.response_received = true THEN 1 END) as responses,
    COUNT(CASE WHEN o.converted = true THEN 1 END) as conversions,
    ROUND(
        COUNT(CASE WHEN o.response_received = true THEN 1 END) * 100.0 / COUNT(*), 2
    ) as response_rate,
    ROUND(
        COUNT(CASE WHEN o.converted = true THEN 1 END) * 100.0 / COUNT(*), 2
    ) as conversion_rate,
    DATE_TRUNC('month', o.created_at) as month,
    NOW() as last_updated
FROM outreach o
WHERE o.created_at >= CURRENT_DATE - INTERVAL '12 months'
GROUP BY o.facility_id, o.channel, DATE_TRUNC('month', o.created_at);

CREATE UNIQUE INDEX idx_outreach_kpis_materialized_unique 
ON analytics.outreach_kpis_materialized (facility_id, channel, month);

-- Combined KPI View
CREATE OR REPLACE VIEW analytics.combined_kpis AS
SELECT 
    p.facility_id,
    p.month,
    p.total_applications,
    p.hired_count,
    p.avg_time_to_fill_days,
    c.compliant_applications,
    c.avg_compliance_score,
    c.violation_count,
    r.total_revenue,
    r.avg_revenue_per_invoice,
    COALESCE(o.total_outreach, 0) as total_outreach,
    COALESCE(o.response_rate, 0) as avg_response_rate,
    COALESCE(o.conversion_rate, 0) as avg_conversion_rate
FROM analytics.pipeline_kpis_materialized p
LEFT JOIN analytics.compliance_kpis_materialized c 
    ON p.facility_id = c.facility_id AND p.month = c.month
LEFT JOIN analytics.revenue_kpis_materialized r 
    ON p.facility_id = r.facility_id AND p.month = r.month
LEFT JOIN (
    SELECT 
        facility_id, 
        month,
        SUM(total_outreach) as total_outreach,
        AVG(response_rate) as response_rate,
        AVG(conversion_rate) as conversion_rate
    FROM analytics.outreach_kpis_materialized
    GROUP BY facility_id, month
) o ON p.facility_id = o.facility_id AND p.month = o.month;
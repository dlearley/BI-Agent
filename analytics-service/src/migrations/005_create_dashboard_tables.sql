-- Create saved views table for dashboard functionality
CREATE TABLE IF NOT EXISTS saved_views (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dashboard_type VARCHAR(50) NOT NULL CHECK (dashboard_type IN ('pipeline', 'revenue', 'compliance', 'outreach', 'combined')),
    filters JSONB NOT NULL DEFAULT '{}',
    layout JSONB NOT NULL DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, name)
);

-- Create dashboard filters table for persistent filter configurations
CREATE TABLE IF NOT EXISTS dashboard_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    view_id UUID REFERENCES saved_views(id) ON DELETE CASCADE,
    filter_name VARCHAR(255) NOT NULL,
    filter_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, view_id, filter_name)
);

-- Create drilldown configurations table
CREATE TABLE IF NOT EXISTS drilldown_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    view_id UUID REFERENCES saved_views(id) ON DELETE CASCADE,
    metric_name VARCHAR(255) NOT NULL,
    drilldown_path JSONB NOT NULL DEFAULT '[]',
    target_table VARCHAR(255) NOT NULL,
    filters JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, view_id, metric_name)
);

-- Create export jobs table for tracking CSV exports
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(255) NOT NULL,
    query_config JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    file_path VARCHAR(500),
    record_count INTEGER DEFAULT 0,
    file_size BIGINT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);

-- Create Kafka topics table for cache invalidation tracking
CREATE TABLE IF NOT EXISTS kafka_topics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create cache invalidation log table
CREATE TABLE IF NOT EXISTS cache_invalidation_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic_name VARCHAR(255) NOT NULL,
    cache_key VARCHAR(500) NOT NULL,
    invalidation_reason VARCHAR(255),
    triggered_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_saved_views_user_id ON saved_views(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_dashboard_type ON saved_views(dashboard_type);
CREATE INDEX IF NOT EXISTS idx_saved_views_is_public ON saved_views(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_dashboard_filters_user_id ON dashboard_filters(user_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_filters_view_id ON dashboard_filters(view_id);
CREATE INDEX IF NOT EXISTS idx_drilldown_configs_user_id ON drilldown_configs(user_id);
CREATE INDEX IF NOT EXISTS idx_drilldown_configs_view_id ON drilldown_configs(view_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_user_id ON export_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_cache_key ON cache_invalidation_log(cache_key);
CREATE INDEX IF NOT EXISTS idx_cache_invalidation_log_created_at ON cache_invalidation_log(created_at);

-- Insert default Kafka topics
INSERT INTO kafka_topics (topic_name, description) VALUES 
    ('analytics-cache-invalidation', 'Cache invalidation for analytics data'),
    ('dashboard-updates', 'Dashboard configuration updates'),
    ('export-notifications', 'Export job notifications')
ON CONFLICT (topic_name) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_saved_views_updated_at BEFORE UPDATE ON saved_views 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_dashboard_filters_updated_at BEFORE UPDATE ON dashboard_filters 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_drilldown_configs_updated_at BEFORE UPDATE ON drilldown_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_kafka_topics_updated_at BEFORE UPDATE ON kafka_topics 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
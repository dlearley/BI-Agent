-- Dashboard tables for the analytics platform

-- Dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL DEFAULT '{}',
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    created_by UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP WITH TIME ZONE,
    tags TEXT[] DEFAULT '{}',
    is_public BOOLEAN DEFAULT FALSE,
    facility_id UUID -- For multi-tenant support
);

-- Widgets table
CREATE TABLE IF NOT EXISTS widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('kpi', 'line', 'area', 'bar', 'table', 'heatmap', 'map')),
    query_id UUID NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    position JSONB NOT NULL DEFAULT '{}',
    drill_through_config JSONB DEFAULT '{}',
    cross_filters JSONB DEFAULT '{}',
    refresh_interval INTEGER DEFAULT 300, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL
);

-- Widget queries table
CREATE TABLE IF NOT EXISTS widget_queries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    query_text TEXT NOT NULL,
    query_type VARCHAR(50) NOT NULL DEFAULT 'sql' CHECK (query_type IN ('sql', 'materialized_view')),
    materialized_view_name VARCHAR(255),
    parameters JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    is_template BOOLEAN DEFAULT FALSE
);

-- Materialized widget data cache
CREATE TABLE IF NOT EXISTS widget_data_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id UUID NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
    query_hash VARCHAR(64) NOT NULL, -- SHA256 hash of the query with parameters
    data JSONB NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_count INTEGER DEFAULT 0,
    last_refreshed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Dashboard versions for versioning
CREATE TABLE IF NOT EXISTS dashboard_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    layout JSONB NOT NULL,
    widgets_snapshot JSONB NOT NULL, -- Snapshot of widgets at this version
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NOT NULL,
    change_description TEXT,
    is_published BOOLEAN DEFAULT FALSE,
    UNIQUE(dashboard_id, version)
);

-- Dashboard sharing
CREATE TABLE IF NOT EXISTS dashboard_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    shared_with_user_id UUID,
    shared_with_role VARCHAR(50),
    permission_level VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit', 'admin')),
    shared_by UUID NOT NULL,
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(dashboard_id, shared_with_user_id)
);

-- Export jobs for PDF/PNG generation
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    export_type VARCHAR(10) NOT NULL CHECK (export_type IN ('pdf', 'png')),
    format_options JSONB DEFAULT '{}',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_path VARCHAR(500),
    file_size BIGINT,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_status ON dashboards(status);
CREATE INDEX IF NOT EXISTS idx_dashboards_facility_id ON dashboards(facility_id);
CREATE INDEX IF NOT EXISTS idx_dashboards_created_at ON dashboards(created_at);

CREATE INDEX IF NOT EXISTS idx_widgets_dashboard_id ON widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_widgets_type ON widgets(type);
CREATE INDEX IF NOT EXISTS idx_widgets_query_id ON widgets(query_id);
CREATE INDEX IF NOT EXISTS idx_widgets_created_at ON widgets(created_at);

CREATE INDEX IF NOT EXISTS idx_widget_queries_created_by ON widget_queries(created_by);
CREATE INDEX IF NOT EXISTS idx_widget_queries_is_template ON widget_queries(is_template);

CREATE INDEX IF NOT EXISTS idx_widget_data_cache_widget_id ON widget_data_cache(widget_id);
CREATE INDEX IF NOT EXISTS idx_widget_data_cache_query_hash ON widget_data_cache(query_hash);
CREATE INDEX IF NOT EXISTS idx_widget_data_cache_expires_at ON widget_data_cache(expires_at);

CREATE INDEX IF NOT EXISTS idx_dashboard_versions_dashboard_id ON dashboard_versions(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_versions_version ON dashboard_versions(dashboard_id, version);

CREATE INDEX IF NOT EXISTS idx_dashboard_shares_dashboard_id ON dashboard_shares(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_shares_shared_with_user_id ON dashboard_shares(shared_with_user_id);

CREATE INDEX IF NOT EXISTS idx_export_jobs_dashboard_id ON export_jobs(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at);

-- Triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widgets_updated_at BEFORE UPDATE ON widgets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_widget_queries_updated_at BEFORE UPDATE ON widget_queries
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
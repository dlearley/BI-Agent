-- Create dashboard widgets table
CREATE TABLE IF NOT EXISTS dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    query_id UUID REFERENCES saved_queries(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('chart', 'kpi', 'table', 'metric', 'gauge', 'stat')),
    title VARCHAR(255),
    description TEXT,
    chart_type VARCHAR(50) CHECK (chart_type IN ('line', 'bar', 'pie', 'area', 'scatter', 'map', 'heatmap')),
    config JSONB DEFAULT '{}',
    position JSONB NOT NULL DEFAULT '{"x": 0, "y": 0, "w": 4, "h": 3}',
    drill_down_config JSONB DEFAULT '{}',
    cross_filter_config JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create dashboard filters table
CREATE TABLE IF NOT EXISTS dashboard_filters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    field_name VARCHAR(255) NOT NULL,
    filter_type VARCHAR(50) NOT NULL CHECK (filter_type IN ('text', 'date', 'number', 'select', 'multi-select', 'range')),
    default_value JSONB,
    options JSONB,
    is_global BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create query results cache table
CREATE TABLE IF NOT EXISTS query_results_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_id UUID NOT NULL REFERENCES saved_queries(id) ON DELETE CASCADE,
    result_hash VARCHAR(64) NOT NULL,
    result_data JSONB NOT NULL,
    query_parameters JSONB,
    execution_time_ms INTEGER,
    row_count INTEGER,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    ttl_seconds INTEGER DEFAULT 3600
);

-- Create dashboard exports table
CREATE TABLE IF NOT EXISTS dashboard_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    export_format VARCHAR(50) NOT NULL CHECK (export_format IN ('pdf', 'csv', 'json', 'excel')),
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    file_path VARCHAR(255),
    file_size_bytes INTEGER,
    export_config JSONB DEFAULT '{}',
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT
);

-- Create natural language suggestions cache table
CREATE TABLE IF NOT EXISTS nl_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connector_id UUID NOT NULL REFERENCES data_connectors(id) ON DELETE CASCADE,
    query_prefix TEXT NOT NULL,
    suggestions JSONB NOT NULL,
    suggestion_count INTEGER,
    cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_dashboard_id ON dashboard_widgets(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_widgets_query_id ON dashboard_widgets(query_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_filters_dashboard_id ON dashboard_filters(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_query_results_cache_query_id ON query_results_cache(query_id);
CREATE INDEX IF NOT EXISTS idx_query_results_cache_expires_at ON query_results_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_dashboard_exports_dashboard_id ON dashboard_exports(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_dashboard_exports_status ON dashboard_exports(status);
CREATE INDEX IF NOT EXISTS idx_nl_suggestions_connector_id ON nl_suggestions(connector_id);

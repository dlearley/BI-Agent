-- Create datasets table for catalog discovery
CREATE TABLE IF NOT EXISTS datasets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    connector_id UUID NOT NULL REFERENCES data_connectors(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    schema_name VARCHAR(255),
    table_name VARCHAR(255) NOT NULL,
    description TEXT,
    row_count INTEGER DEFAULT 0,
    stats_json JSONB DEFAULT '{}',
    freshness_sla_hours INTEGER DEFAULT 24,
    last_discovered_at TIMESTAMP,
    last_profiled_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    UNIQUE(organization_id, connector_id, schema_name, table_name)
);

-- Create columns table for catalog column metadata
CREATE TABLE IF NOT EXISTS columns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dataset_id UUID NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    column_name VARCHAR(255) NOT NULL,
    column_type VARCHAR(100) NOT NULL,
    description TEXT,
    is_nullable BOOLEAN DEFAULT TRUE,
    stats_json JSONB DEFAULT '{}',
    is_pii BOOLEAN DEFAULT FALSE,
    pii_type VARCHAR(50),
    pii_confidence DECIMAL(3,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(dataset_id, column_name)
);

-- Create lineage table for tracking upstream/downstream dependencies
CREATE TABLE IF NOT EXISTS column_lineage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    source_column_id UUID NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    target_column_id UUID REFERENCES columns(id) ON DELETE CASCADE,
    source_table VARCHAR(255),
    target_table VARCHAR(255),
    lineage_type VARCHAR(50) DEFAULT 'upstream' CHECK (lineage_type IN ('upstream', 'downstream', 'sibling')),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_datasets_org_id ON datasets(organization_id);
CREATE INDEX IF NOT EXISTS idx_datasets_connector_id ON datasets(connector_id);
CREATE INDEX IF NOT EXISTS idx_datasets_created_at ON datasets(created_at);
CREATE INDEX IF NOT EXISTS idx_datasets_last_profiled ON datasets(last_profiled_at);
CREATE INDEX IF NOT EXISTS idx_columns_dataset_id ON columns(dataset_id);
CREATE INDEX IF NOT EXISTS idx_columns_is_pii ON columns(is_pii) WHERE is_pii = TRUE;
CREATE INDEX IF NOT EXISTS idx_columns_pii_type ON columns(pii_type);
CREATE INDEX IF NOT EXISTS idx_lineage_org_id ON column_lineage(organization_id);
CREATE INDEX IF NOT EXISTS idx_lineage_source ON column_lineage(source_column_id);
CREATE INDEX IF NOT EXISTS idx_lineage_target ON column_lineage(target_column_id);
CREATE INDEX IF NOT EXISTS idx_lineage_type ON column_lineage(lineage_type);

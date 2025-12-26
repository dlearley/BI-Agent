-- Create data_sources table
CREATE TABLE IF NOT EXISTS data_sources (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL,
  schema JSONB,
  column_profiles JSONB,
  created_by UUID NOT NULL,
  facility_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
  CONSTRAINT fk_data_sources_created_by FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Create indexes
CREATE INDEX idx_data_sources_type ON data_sources(type);
CREATE INDEX idx_data_sources_enabled ON data_sources(enabled);
CREATE INDEX idx_data_sources_created_by ON data_sources(created_by);
CREATE INDEX idx_data_sources_facility_id ON data_sources(facility_id);
CREATE INDEX idx_data_sources_created_at ON data_sources(created_at DESC);

-- Add comments
COMMENT ON TABLE data_sources IS 'Stores data source configurations for connectors';
COMMENT ON COLUMN data_sources.type IS 'Type of data source: postgres, csv, s3_parquet';
COMMENT ON COLUMN data_sources.config IS 'Connection configuration stored as JSON';
COMMENT ON COLUMN data_sources.schema IS 'Discovered schema metadata';
COMMENT ON COLUMN data_sources.column_profiles IS 'Column profiling statistics';

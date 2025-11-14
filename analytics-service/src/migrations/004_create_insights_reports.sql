-- Migration: Create insights reports table
-- Description: Stores ML-generated insights reports including anomalies, drivers, and narrative

CREATE TABLE IF NOT EXISTS analytics.insights_reports (
  id VARCHAR(255) PRIMARY KEY,
  timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  query_params JSONB NOT NULL,
  anomalies JSONB NOT NULL,
  drivers JSONB NOT NULL,
  trends JSONB NOT NULL,
  narrative TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_insights_reports_timestamp 
  ON analytics.insights_reports(timestamp);

CREATE INDEX IF NOT EXISTS idx_insights_reports_created_at 
  ON analytics.insights_reports(created_at);

COMMENT ON TABLE analytics.insights_reports IS 
  'Stores ML-generated insights reports with anomaly detection, driver analysis, and narrative';

COMMENT ON COLUMN analytics.insights_reports.id IS 
  'Unique identifier for the report';

COMMENT ON COLUMN analytics.insights_reports.timestamp IS 
  'Report generation timestamp';

COMMENT ON COLUMN analytics.insights_reports.query_params IS 
  'Query parameters used to generate the report (JSON)';

COMMENT ON COLUMN analytics.insights_reports.anomalies IS 
  'Detected anomalies with statistics (JSON)';

COMMENT ON COLUMN analytics.insights_reports.drivers IS 
  'Feature importance and driver analysis (JSON)';

COMMENT ON COLUMN analytics.insights_reports.trends IS 
  'Trend analysis including direction and variance (JSON)';

COMMENT ON COLUMN analytics.insights_reports.narrative IS 
  'Human-readable narrative text describing the insights';

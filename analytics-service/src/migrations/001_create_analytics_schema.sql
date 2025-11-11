-- Create analytics schema
CREATE SCHEMA IF NOT EXISTS analytics;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX IF NOT EXISTS idx_applications_facility_id ON applications(facility_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_facility_id ON invoices(facility_id);
CREATE INDEX IF NOT EXISTS idx_outreach_created_at ON outreach(created_at);
CREATE INDEX IF NOT EXISTS idx_outreach_facility_id ON outreach(facility_id);
CREATE INDEX IF NOT EXISTS idx_outreach_channel ON outreach(channel);
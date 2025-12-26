-- Create CRM staging tables for analytics
-- These tables are partitioned by organization_id and date for efficient querying

-- CRM Leads staging table
CREATE TABLE IF NOT EXISTS analytics.crm_leads_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    lead_id VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(100),
    company VARCHAR(255),
    title VARCHAR(255),
    source VARCHAR(100),
    status VARCHAR(50),
    score INTEGER,
    assigned_to VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    ingestion_id UUID DEFAULT uuid_generate_v4(),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL),
    CONSTRAINT valid_score CHECK (score >= 0 AND score <= 100 OR score IS NULL)
) PARTITION BY RANGE (event_timestamp);

-- Create partitions for current and future months (automatically managed)
CREATE TABLE IF NOT EXISTS analytics.crm_leads_staging_current 
    PARTITION OF analytics.crm_leads_staging 
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- CRM Contacts staging table
CREATE TABLE IF NOT EXISTS analytics.crm_contacts_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    contact_id VARCHAR(255) NOT NULL,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(100),
    company VARCHAR(255),
    title VARCHAR(255),
    lead_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    ingestion_id UUID DEFAULT uuid_generate_v4(),
    CONSTRAINT valid_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' OR email IS NULL)
) PARTITION BY RANGE (event_timestamp);

CREATE TABLE IF NOT EXISTS analytics.crm_contacts_staging_current 
    PARTITION OF analytics.crm_contacts_staging 
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- CRM Opportunities staging table
CREATE TABLE IF NOT EXISTS analytics.crm_opportunities_staging (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    opportunity_id VARCHAR(255) NOT NULL,
    name VARCHAR(500) NOT NULL,
    lead_id VARCHAR(255),
    contact_id VARCHAR(255),
    amount DECIMAL(15,2),
    currency VARCHAR(3) DEFAULT 'USD',
    stage VARCHAR(100),
    probability INTEGER,
    expected_close_date DATE,
    created_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type VARCHAR(50) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB,
    ingestion_id UUID DEFAULT uuid_generate_v4(),
    CONSTRAINT valid_amount CHECK (amount >= 0 OR amount IS NULL),
    CONSTRAINT valid_probability CHECK (probability >= 0 AND probability <= 100 OR probability IS NULL),
    CONSTRAINT valid_currency CHECK (currency ~* '^[A-Z]{3}$')
) PARTITION BY RANGE (event_timestamp);

CREATE TABLE IF NOT EXISTS analytics.crm_opportunities_staging_current 
    PARTITION OF analytics.crm_opportunities_staging 
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- CRM Events log table for tracking all processed events
CREATE TABLE IF NOT EXISTS analytics.crm_events_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255) UNIQUE NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    topic VARCHAR(100) NOT NULL,
    partition INTEGER NOT NULL,
    offset BIGINT NOT NULL,
    organization_id VARCHAR(100) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processing_status VARCHAR(20) DEFAULT 'processed',
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    ingestion_id UUID DEFAULT uuid_generate_v4(),
    metadata JSONB,
    CONSTRAINT valid_status CHECK (processing_status IN ('processed', 'failed', 'skipped')),
    CONSTRAINT valid_retry_count CHECK (retry_count >= 0)
) PARTITION BY RANGE (event_timestamp);

CREATE TABLE IF NOT EXISTS analytics.crm_events_log_current 
    PARTITION OF analytics.crm_events_log 
    FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

-- Create indexes for efficient querying and duplicate detection
CREATE INDEX IF NOT EXISTS idx_crm_leads_staging_event_id ON analytics.crm_leads_staging(event_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_staging_lead_id ON analytics.crm_leads_staging(lead_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_staging_org_date ON analytics.crm_leads_staging(organization_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_crm_leads_staging_email ON analytics.crm_leads_staging(email);

CREATE INDEX IF NOT EXISTS idx_crm_contacts_staging_event_id ON analytics.crm_contacts_staging(event_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_staging_contact_id ON analytics.crm_contacts_staging(contact_id);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_staging_org_date ON analytics.crm_contacts_staging(organization_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_crm_contacts_staging_email ON analytics.crm_contacts_staging(email);

CREATE INDEX IF NOT EXISTS idx_crm_opportunities_staging_event_id ON analytics.crm_opportunities_staging(event_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_staging_opportunity_id ON analytics.crm_opportunities_staging(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_staging_org_date ON analytics.crm_opportunities_staging(organization_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_staging_stage ON analytics.crm_opportunities_staging(stage);

CREATE INDEX IF NOT EXISTS idx_crm_events_log_event_id ON analytics.crm_events_log(event_id);
CREATE INDEX IF NOT EXISTS idx_crm_events_log_org_date ON analytics.crm_events_log(organization_id, event_timestamp);
CREATE INDEX IF NOT EXISTS idx_crm_events_log_topic_partition_offset ON analytics.crm_events_log(topic, partition, offset);
CREATE INDEX IF NOT EXISTS idx_crm_events_log_status ON analytics.crm_events_log(processing_status);

-- Create a function to manage partition creation automatically
CREATE OR REPLACE FUNCTION analytics.create_monthly_partition(table_name text, start_date date)
RETURNS void AS $$
DECLARE
    partition_name text;
    end_date date;
BEGIN
    partition_name := table_name || '_' || to_char(start_date, 'YYYY_MM');
    end_date := start_date + interval '1 month';
    
    EXECUTE format('CREATE TABLE IF NOT EXISTS analytics.%I PARTITION OF analytics.%I FOR VALUES FROM (%L) TO (%L)',
                   partition_name, table_name, start_date, end_date);
END;
$$ LANGUAGE plpgsql;

-- Create a function to handle late arriving data by checking if event already processed
CREATE OR REPLACE FUNCTION analytics.is_event_processed(event_id_param text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM analytics.crm_events_log 
        WHERE event_id = event_id_param
        AND processing_status = 'processed'
    );
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA analytics TO analytics_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA analytics TO analytics_user;
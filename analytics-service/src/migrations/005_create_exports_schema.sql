-- Analytics Exports Schema
-- Handles export schedules, recipients, and job tracking

-- Export schedules table
CREATE TABLE IF NOT EXISTS export_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    export_type VARCHAR(50) NOT NULL CHECK (export_type IN ('dashboard', 'kpi', 'compliance', 'revenue', 'outreach')),
    format VARCHAR(10) NOT NULL CHECK (format IN ('csv', 'pdf')),
    schedule_expression VARCHAR(100) NOT NULL, -- Cron expression
    is_active BOOLEAN DEFAULT true,
    filters JSONB DEFAULT '{}', -- Export filters (date range, facility, etc.)
    template_data JSONB DEFAULT '{}', -- Email/Slack template data
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE
);

-- Export recipients table
CREATE TABLE IF NOT EXISTS export_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID NOT NULL REFERENCES export_schedules(id) ON DELETE CASCADE,
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('email', 'slack')),
    recipient_address VARCHAR(500) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export jobs table
CREATE TABLE IF NOT EXISTS export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    schedule_id UUID REFERENCES export_schedules(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    export_type VARCHAR(50) NOT NULL,
    format VARCHAR(10) NOT NULL,
    filters JSONB DEFAULT '{}',
    file_path VARCHAR(1000), -- S3 path
    file_size BIGINT,
    signed_url VARCHAR(2000), -- Temporary signed URL
    signed_url_expires_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Export notifications table (tracks sent notifications)
CREATE TABLE IF NOT EXISTS export_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
    recipient_id UUID REFERENCES export_recipients(id),
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('email', 'slack')),
    recipient_address VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_export_schedules_active ON export_schedules(is_active);
CREATE INDEX IF NOT EXISTS idx_export_schedules_next_run ON export_schedules(next_run_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_export_schedules_created_by ON export_schedules(created_by);
CREATE INDEX IF NOT EXISTS idx_export_recipients_schedule_id ON export_recipients(schedule_id);
CREATE INDEX IF NOT EXISTS idx_export_recipients_active ON export_recipients(is_active);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status);
CREATE INDEX IF NOT EXISTS idx_export_jobs_schedule_id ON export_jobs(schedule_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_created_at ON export_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_export_notifications_job_id ON export_notifications(job_id);
CREATE INDEX IF NOT EXISTS idx_export_notifications_status ON export_notifications(status);

-- RLS (Row Level Security) policies
ALTER TABLE export_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE export_notifications ENABLE ROW LEVEL SECURITY;

-- Policy for export_schedules: Users can see their own schedules, admins can see all
CREATE POLICY export_schedules_rls ON export_schedules
    USING (
        created_by = current_setting('app.current_user_id')::uuid 
        OR current_setting('app.current_user_role') = 'admin'
    );

-- Policy for export_recipients: View through schedule relationship
CREATE POLICY export_recipients_rls ON export_recipients
    USING (
        EXISTS (
            SELECT 1 FROM export_schedules es 
            WHERE es.id = export_recipients.schedule_id 
            AND (
                es.created_by = current_setting('app.current_user_id')::uuid 
                OR current_setting('app.current_user_role') = 'admin'
            )
        )
    );

-- Policy for export_jobs: Users can see their own jobs, admins can see all
CREATE POLICY export_jobs_rls ON export_jobs
    USING (
        created_by = current_setting('app.current_user_id')::uuid 
        OR current_setting('app.current_user_role') = 'admin'
        OR (
            schedule_id IN (
                SELECT id FROM export_schedules es 
                WHERE es.created_by = current_setting('app.current_user_id')::uuid 
                OR current_setting('app.current_user_role') = 'admin'
            )
        )
    );

-- Policy for export_notifications: View through job relationship
CREATE POLICY export_notifications_rls ON export_notifications
    USING (
        EXISTS (
            SELECT 1 FROM export_jobs ej 
            WHERE ej.id = export_notifications.job_id 
            AND (
                ej.created_by = current_setting('app.current_user_id')::uuid 
                OR current_setting('app.current_user_role') = 'admin'
                OR (
                    ej.schedule_id IN (
                        SELECT id FROM export_schedules es 
                        WHERE es.created_by = current_setting('app.current_user_id')::uuid 
                        OR current_setting('app.current_user_role') = 'admin'
                    )
                )
            )
        )
    );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_export_schedules_updated_at 
    BEFORE UPDATE ON export_schedules 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get next run time based on cron expression
CREATE OR REPLACE FUNCTION calculate_next_run(cron_expression VARCHAR)
RETURNS TIMESTAMP WITH TIME ZONE AS $$
BEGIN
    -- This is a simplified version. In production, you might want to use
    -- a proper cron parsing library or service
    RETURN NOW() + INTERVAL '1 hour'; -- Default to 1 hour for now
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old export jobs and files
CREATE OR REPLACE FUNCTION cleanup_old_export_jobs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete old jobs and their notifications
    DELETE FROM export_notifications 
    WHERE job_id IN (
        SELECT id FROM export_jobs 
        WHERE created_at < NOW() - INTERVAL '1 day' * retention_days
    );
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    DELETE FROM export_jobs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = deleted_count + ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
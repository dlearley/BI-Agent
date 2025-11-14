-- Create alerts configuration table
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  metric VARCHAR(100) NOT NULL, -- e.g., 'revenue', 'pipeline_count', 'compliance_rate'
  alert_type VARCHAR(50) NOT NULL, -- 'threshold', 'percent_change', 'anomaly'
  
  -- Threshold configuration
  threshold_value DECIMAL(15, 2),
  threshold_operator VARCHAR(10), -- '>', '<', '>=', '<=', '='
  
  -- Percent change configuration
  percent_change_value DECIMAL(10, 2),
  percent_change_period VARCHAR(50), -- 'daily', 'weekly', 'monthly'
  percent_change_direction VARCHAR(10), -- 'increase', 'decrease', 'any'
  
  -- Anomaly detection configuration
  anomaly_sensitivity VARCHAR(20), -- 'low', 'medium', 'high'
  anomaly_lookback_days INTEGER DEFAULT 30,
  
  -- Evaluation settings
  evaluation_frequency VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly'
  evaluation_schedule VARCHAR(100), -- cron expression or simple schedule
  
  -- Filter criteria
  facility_id UUID,
  date_range_start DATE,
  date_range_end DATE,
  
  -- Notification channels
  channels JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of channel configs
  
  -- State
  enabled BOOLEAN DEFAULT true,
  last_evaluated_at TIMESTAMP WITH TIME ZONE,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_alerts_metric ON alerts(metric);
CREATE INDEX idx_alerts_enabled ON alerts(enabled);
CREATE INDEX idx_alerts_facility ON alerts(facility_id);

-- Create alert notifications audit log table
CREATE TABLE IF NOT EXISTS alert_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id UUID NOT NULL REFERENCES alerts(id) ON DELETE CASCADE,
  
  -- Trigger details
  triggered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metric_value DECIMAL(15, 2) NOT NULL,
  threshold_breached DECIMAL(15, 2),
  
  -- Notification details
  channel_type VARCHAR(50) NOT NULL, -- 'slack', 'email', 'webhook'
  channel_config JSONB NOT NULL,
  recipient VARCHAR(255),
  
  -- Status
  status VARCHAR(50) NOT NULL, -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  details JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_alert_notifications_alert ON alert_notifications(alert_id);
CREATE INDEX idx_alert_notifications_status ON alert_notifications(status);
CREATE INDEX idx_alert_notifications_triggered ON alert_notifications(triggered_at);

-- Create reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  report_type VARCHAR(50) NOT NULL, -- 'weekly_briefing', 'monthly_summary', 'custom'
  
  -- Schedule settings
  schedule VARCHAR(100) NOT NULL, -- cron expression or 'manual'
  
  -- Content configuration
  metrics JSONB NOT NULL DEFAULT '[]'::jsonb, -- array of metric types to include
  date_range_type VARCHAR(50) NOT NULL, -- 'last_week', 'last_month', 'custom'
  include_charts BOOLEAN DEFAULT true,
  include_narrative BOOLEAN DEFAULT true,
  
  -- Filter criteria
  facility_id UUID,
  
  -- Delivery channels
  channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  
  -- State
  enabled BOOLEAN DEFAULT true,
  last_generated_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255) NOT NULL
);

CREATE INDEX idx_reports_type ON reports(report_type);
CREATE INDEX idx_reports_enabled ON reports(enabled);
CREATE INDEX idx_reports_facility ON reports(facility_id);

-- Create report generations table (audit log)
CREATE TABLE IF NOT EXISTS report_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  
  -- Generation details
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  date_range_start DATE NOT NULL,
  date_range_end DATE NOT NULL,
  
  -- Content
  narrative TEXT,
  charts JSONB DEFAULT '[]'::jsonb, -- array of chart data/URLs
  pdf_url VARCHAR(500),
  
  -- Delivery status
  status VARCHAR(50) NOT NULL, -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMP WITH TIME ZONE,
  recipients JSONB DEFAULT '[]'::jsonb,
  error_message TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb,
  file_size_bytes INTEGER
);

CREATE INDEX idx_report_generations_report ON report_generations(report_id);
CREATE INDEX idx_report_generations_status ON report_generations(status);
CREATE INDEX idx_report_generations_generated ON report_generations(generated_at);

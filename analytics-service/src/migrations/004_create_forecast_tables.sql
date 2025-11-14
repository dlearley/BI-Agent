-- Create forecasts table
CREATE TABLE IF NOT EXISTS forecasts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    predictions JSONB NOT NULL,
    backtest JSONB,
    assumptions JSONB NOT NULL DEFAULT '{}',
    model_accuracy DECIMAL(5,4),
    data_points INTEGER,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    horizon INTEGER NOT NULL,
    frequency VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create forecast_scenarios table
CREATE TABLE IF NOT EXISTS forecast_scenarios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    forecast_id UUID NOT NULL REFERENCES forecasts(id) ON DELETE CASCADE,
    assumptions JSONB NOT NULL DEFAULT '{}',
    created_by VARCHAR(255) NOT NULL,
    is_report BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_forecasts_metric ON forecasts(metric);
CREATE INDEX IF NOT EXISTS idx_forecasts_model ON forecasts(model);
CREATE INDEX IF NOT EXISTS idx_forecasts_created_at ON forecasts(created_at);
CREATE INDEX IF NOT EXISTS idx_forecast_scenarios_forecast_id ON forecast_scenarios(forecast_id);
CREATE INDEX IF NOT EXISTS idx_forecast_scenarios_created_by ON forecast_scenarios(created_by);
CREATE INDEX IF NOT EXISTS idx_forecast_scenarios_is_report ON forecast_scenarios(is_report);
CREATE INDEX IF NOT EXISTS idx_forecast_scenarios_created_at ON forecast_scenarios(created_at);

-- Add RLS (Row Level Security) for HIPAA compliance
ALTER TABLE forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_scenarios ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for forecasts
CREATE POLICY "Users can view their own facility forecasts" ON forecasts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_setting('app.current_user_id', true)::uuid 
            AND (u.role = 'admin' OR u.facility_id = current_setting('app.current_facility_id', true))
        )
    );

CREATE POLICY "Admins can manage all forecasts" ON forecasts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_setting('app.current_user_id', true)::uuid 
            AND u.role = 'admin'
        )
    );

-- Create RLS policies for forecast_scenarios
CREATE POLICY "Users can manage their own scenarios" ON forecast_scenarios
    FOR ALL USING (
        created_by = current_setting('app.current_user_id', true)
    );

CREATE POLICY "Admins can view all scenarios" ON forecast_scenarios
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users u 
            WHERE u.id = current_setting('app.current_user_id', true)::uuid 
            AND u.role = 'admin'
        )
    );

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_forecasts_updated_at BEFORE UPDATE ON forecasts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_forecast_scenarios_updated_at BEFORE UPDATE ON forecast_scenarios
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE forecasts IS 'Stores forecast results from ML service';
COMMENT ON TABLE forecast_scenarios IS 'Stores user-created forecast scenarios and reports';
COMMENT ON COLUMN forecasts.metric IS 'The metric being forecasted (revenue, pipeline_count, etc.)';
COMMENT ON COLUMN forecasts.model IS 'The ML model used (prophet, arima, xgboost)';
COMMENT ON COLUMN forecasts.predictions IS 'JSON array of forecast points with confidence intervals';
COMMENT ON COLUMN forecasts.backtest IS 'JSON object containing backtest metrics';
COMMENT ON COLUMN forecasts.assumptions IS 'JSON object of forecast assumptions and parameters';
COMMENT ON COLUMN forecast_scenarios.is_report IS 'Whether this scenario is saved as a formal report';
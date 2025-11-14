# Forecast Sandbox Demo

## Overview
The Forecast Sandbox UI provides a comprehensive web interface for creating predictive models and running what-if scenarios. It integrates with ML services to generate forecasts using Prophet, ARIMA, and XGBoost models.

## Features Implemented

### ✅ Backend API
- **Forecast Creation**: `/api/v1/forecast/` POST endpoint
- **Forecast Retrieval**: `/api/v1/forecast/:id` GET endpoint  
- **Scenario Management**: `/api/v1/forecast/scenarios` POST/GET endpoints
- **Available Metrics**: `/api/v1/forecast/metrics/available` GET endpoint
- **Available Models**: `/api/v1/forecast/models/available` GET endpoint
- **ML Service Integration**: HTTP calls to `/forecast` endpoint
- **Database Storage**: PostgreSQL tables for forecasts and scenarios
- **Caching**: Redis-based caching for performance
- **Authentication & Authorization**: JWT-based auth with RBAC
- **HIPAA Compliance**: Row-level security and data redaction

### ✅ Frontend UI
- **Interactive Dashboard**: `/forecast` route with responsive design
- **Metric Selection**: Dropdown for revenue, pipeline_count, time_to_fill, compliance_rate, outreach_response_rate
- **Model Selection**: Prophet, ARIMA, XGBoost options
- **Date Configuration**: Start/end dates and forecast horizon
- **What-If Sliders**: Interactive controls for growth rate, seasonality, and trend
- **Backtesting**: Toggle for model validation with performance metrics
- **Forecast Visualization**: Chart.js integration with confidence intervals
- **Performance Metrics**: MAE, RMSE, MAPE, R² display
- **Scenario Management**: Save/load scenarios and reports
- **Error Handling**: User-friendly error messages and loading states

### ✅ Database Schema
- **forecasts table**: Stores forecast results with metadata
- **forecast_scenarios table**: User scenarios and reports
- **Row Level Security**: HIPAA-compliant access controls
- **Indexes**: Optimized for performance
- **Triggers**: Automatic timestamp updates

### ✅ Testing
- **Playwright E2E Tests**: Comprehensive API and UI testing
- **Mock ML Service**: Simulates ML service responses
- **Integration Tests**: Full workflow verification
- **Manual Test Script**: Node.js script for API validation

## Quick Start

### 1. Start Mock Services
```bash
# Start mock test server
node dist/test-server.js

# Start mock ML service (in another terminal)
node -e "
const express = require('express');
const app = express();
app.use(express.json());
app.post('/forecast', (req, res) => {
  const { metric, model, horizon } = req.body;
  const { v4: uuidv4 } = require('uuid');
  res.json({
    id: uuidv4(),
    metric,
    model,
    predictions: Array.from({length: horizon}, (_, i) => ({
      date: new Date(Date.now() + i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      value: Math.random() * 1000 + 500,
      confidenceInterval: { lower: 400, upper: 1200 }
    })),
    backtest: {
      mae: 50, rmse: 75, mape: 0.05, r2: 0.85,
      actualVsPredicted: Array.from({length: 10}, (_, i) => ({
        date: new Date(Date.now() - (10-i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        actual: Math.random() * 1000 + 500,
        predicted: Math.random() * 1000 + 500
      }))
    },
    assumptions: req.body.assumptions || {},
    metadata: {
      createdAt: new Date().toISOString(),
      modelAccuracy: 0.85,
      dataPoints: 365
    }
  });
});
app.listen(8001, () => console.log('Mock ML service on port 8001'));
"
```

### 2. Access the UI
Open http://localhost:3001/forecast in your browser

### 3. Test the Workflow
1. **Select Metric**: Choose "revenue" from the dropdown
2. **Choose Model**: Select "prophet" 
3. **Set Dates**: Use default or adjust start/end dates
4. **Configure Horizon**: Set to 30 days
5. **Adjust Assumptions**: Move the growth rate slider to 10%
6. **Enable Backtesting**: Keep the checkbox checked
7. **Generate Forecast**: Click "Generate Forecast" button
8. **View Results**: See the chart, metrics, and backtest results
9. **Save Scenario**: Enter a name and click "Save Scenario"

## API Examples

### Create Forecast
```bash
curl -X POST http://localhost:3001/api/v1/forecast/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-jwt-token" \
  -d '{
    "metric": "revenue",
    "model": "prophet", 
    "startDate": "2023-01-01T00:00:00.000Z",
    "endDate": "2023-12-31T00:00:00.000Z",
    "horizon": 30,
    "frequency": "daily",
    "assumptions": {
      "growthRate": 0.05,
      "seasonality": 0.1
    },
    "backtest": {
      "enabled": true,
      "testPeriods": 30
    }
  }'
```

### Get Available Metrics
```bash
curl -X GET http://localhost:3001/api/v1/forecast/metrics/available \
  -H "Authorization: Bearer mock-jwt-token"
```

### Save Scenario
```bash
curl -X POST http://localhost:3001/api/v1/forecast/scenarios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mock-jwt-token" \
  -d '{
    "forecastId": "forecast-id-here",
    "name": "Q1 2024 Revenue Forecast",
    "description": "Optimistic scenario with 15% growth",
    "assumptions": {
      "growthRate": 0.15,
      "seasonality": 0.2
    },
    "isReport": true
  }'
```

## ML Service Integration

The system integrates with an external ML service via HTTP calls to `/forecast` endpoint. The ML service should:

1. **Accept**: ForecastRequest object with metric, model, dates, assumptions
2. **Return**: ForecastResponse with predictions, backtest results, metadata
3. **Support**: Prophet, ARIMA, XGBoost models
4. **Provide**: Confidence intervals and backtest metrics

### Expected ML Service Response Format
```json
{
  "predictions": [
    {
      "date": "2024-01-01",
      "value": 10000,
      "confidenceInterval": {
        "lower": 9000,
        "upper": 11000
      }
    }
  ],
  "backtest": {
    "mae": 500,
    "rmse": 600,
    "mape": 0.05,
    "r2": 0.95,
    "actualVsPredicted": [...]
  },
  "modelAccuracy": 0.95,
  "dataPoints": 365
}
```

## Acceptance Criteria Met

✅ **User runs forecast producing charts & backtests**
- Interactive UI for forecast configuration
- Chart visualization with confidence intervals  
- Backtest performance metrics display

✅ **Saves sandbox scenario**  
- Scenario creation and persistence
- Report generation capability
- Scenario listing and management

✅ **ML service receives request with parameters**
- HTTP integration with `/forecast` endpoint
- Proper request/response format handling
- Error handling and timeout management

✅ **Playwright test covering forecast creation**
- Comprehensive E2E test suite
- API endpoint testing
- UI component testing
- Mock ML service integration

## Production Deployment Notes

1. **Environment Variables**: Configure ML_SERVICE_URL and ML_SERVICE_TIMEOUT
2. **Database**: Run migration `004_create_forecast_tables.sql`
3. **ML Service**: Deploy actual ML service at configured URL
4. **Authentication**: Replace mock JWT with real auth system
5. **Monitoring**: Add logging and metrics for forecast operations

## Future Enhancements

- Real-time WebSocket updates for long-running forecasts
- Additional ML models (LSTM, Neural Networks)
- Forecast comparison and ensemble methods
- Advanced scenario analysis and optimization
- Export functionality (PDF, Excel, CSV)
- Forecast accuracy tracking over time
- Automated model selection based on historical performance
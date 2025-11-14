# Insights ML Service Documentation

## Overview

The Insights ML service extends the analytics platform with advanced machine learning capabilities for anomaly detection, feature attribution, and automated narrative generation.

## Features

### 1. Anomaly Detection

Detects unusual patterns in time series data using statistical methods:

- **ESD (Extreme Studentized Deviate)**: Iteratively detects multiple outliers
- **Z-Score**: Standard deviation-based anomaly detection
- **Seasonality Handling**: Removes seasonal patterns before detection

#### API Endpoint: POST `/api/v1/insights/ml/anomaly-detect`

**Request:**
```json
{
  "data": [
    { "timestamp": "2024-01-01", "value": 100 },
    { "timestamp": "2024-01-02", "value": 105 }
  ],
  "method": "esd",
  "seasonalPeriod": 7,
  "threshold": 3,
  "alpha": 0.05
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "anomalies": [
      {
        "timestamp": "2024-01-10",
        "value": 300,
        "expectedValue": 102.5,
        "score": 4.5,
        "severity": "high"
      }
    ],
    "statistics": {
      "mean": 105.2,
      "stdDev": 15.3,
      "threshold": 3,
      "method": "esd"
    }
  }
}
```

**Parameters:**
- `method`: "esd" or "zscore" (default: "esd")
- `seasonalPeriod`: Number of periods in seasonal cycle (default: 7)
- `threshold`: Detection sensitivity (default: 3)
- `alpha`: Significance level for ESD method (default: 0.05)

### 2. Driver Analysis

Identifies key features driving performance metrics using feature importance and correlation analysis:

- **Feature Importance**: Combines correlation with variance weighting
- **Contribution Analysis**: Quantifies impact direction and magnitude
- **Correlation Method**: Pure correlation-based ranking

#### API Endpoint: POST `/api/v1/insights/ml/drivers`

**Request:**
```json
{
  "features": {
    "job_postings": [10, 15, 12, 18, 20],
    "response_rate": [0.3, 0.35, 0.32, 0.38, 0.40],
    "avg_salary": [75000, 76000, 75500, 77000, 78000]
  },
  "target": [25, 32, 28, 38, 45],
  "method": "importance",
  "topN": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "drivers": [
      {
        "feature": "job_postings",
        "importance": 0.95,
        "contribution": 1.8,
        "direction": "positive"
      }
    ],
    "metadata": {
      "method": "importance",
      "totalFeatures": 3,
      "samplesAnalyzed": 5
    }
  }
}
```

**Parameters:**
- `method`: "importance" or "correlation" (default: "importance")
- `topN`: Number of top drivers to return (default: 5)

### 3. Insights Reports

Generates comprehensive reports combining anomaly detection, driver analysis, trend detection, and narrative summaries.

#### API Endpoint: GET `/api/v1/insights`

**Query Parameters:**
- `startDate`: Start date (YYYY-MM-DD)
- `endDate`: End date (YYYY-MM-DD)
- `facilityId`: Filter by facility (optional)

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "insight_1234567890_abc123",
    "timestamp": "2024-01-15T10:30:00Z",
    "query": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    },
    "anomalies": {
      "detected": [],
      "statistics": {},
      "totalPoints": 30,
      "anomalyRate": 0.0
    },
    "drivers": {
      "topDrivers": [
        {
          "feature": "active_applications",
          "importance": 0.85,
          "contribution": 1.2,
          "direction": "positive"
        }
      ],
      "metadata": {}
    },
    "trends": {
      "direction": "increasing",
      "strength": 0.15,
      "variance": 125.5,
      "changeRate": 0.08
    },
    "narrative": "Metrics show an upward trend with 8.0% growth rate. Moderate variance suggests some fluctuations in performance. No significant anomalies detected in the analyzed period. Key performance driver: active_applications with 85.0% importance and positive contribution."
  }
}
```

#### API Endpoint: GET `/api/v1/insights/:reportId`

Retrieve a previously generated report by ID.

## Usage Examples

### Example 1: Detecting Application Volume Spikes

```typescript
import { mlService } from './services/ml.service';

const applicationData = [
  { timestamp: '2024-01-01', value: 45 },
  { timestamp: '2024-01-02', value: 48 },
  { timestamp: '2024-01-03', value: 52 },
  // ... more data
  { timestamp: '2024-01-10', value: 120 }, // spike
  { timestamp: '2024-01-11', value: 50 },
];

const result = mlService.detectAnomalies(applicationData, {
  method: 'zscore',
  threshold: 2,
  seasonalPeriod: 7,
});

console.log(`Detected ${result.anomalies.length} anomalies`);
result.anomalies.forEach(anomaly => {
  console.log(`${anomaly.timestamp}: ${anomaly.value} (${anomaly.severity})`);
});
```

### Example 2: Identifying Recruitment Drivers

```typescript
const features = {
  job_postings: [10, 15, 12, 18, 20, 22, 25],
  response_rate: [0.3, 0.35, 0.32, 0.38, 0.40, 0.42, 0.45],
  avg_salary_offered: [75000, 76000, 75500, 77000, 78000, 79000, 80000],
  facility_rating: [4.2, 4.2, 4.3, 4.3, 4.4, 4.4, 4.5],
};

const placements = [25, 32, 28, 38, 45, 48, 55];

const result = mlService.analyzeDrivers(features, placements, {
  method: 'importance',
  topN: 3,
});

console.log('Top 3 Performance Drivers:');
result.drivers.forEach((driver, idx) => {
  console.log(`${idx + 1}. ${driver.feature}: ${(driver.importance * 100).toFixed(1)}%`);
});
```

### Example 3: Generating Full Insights Report

```typescript
import { insightsService } from './services/insights.service';

const insights = await insightsService.generateInsights(
  {
    startDate: '2024-01-01',
    endDate: '2024-01-31',
  },
  user
);

console.log(insights.narrative);
console.log(`Trend: ${insights.trends.direction}`);
console.log(`Anomalies: ${insights.anomalies.detected.length}`);
console.log(`Top Driver: ${insights.drivers.topDrivers[0]?.feature}`);
```

## Running the Demo

```bash
cd analytics-service
npm run build
node dist/scripts/demo-insights.js
```

The demo generates synthetic healthcare recruitment data and demonstrates:
- Anomaly detection with seasonality
- Driver analysis with multiple features
- Trend calculation
- Automated narrative generation

## Testing

The service includes comprehensive test coverage:

```bash
# Run ML service tests
npm test -- ml.service.test

# Run insights service tests
npm test -- insights.service.test

# Run controller tests
npm test -- insights.controller.test

# Run integration tests with demo data
npm test -- insights.integration.test

# Run all insights tests
npm test -- insights
```

Test coverage includes:
- Anomaly detection (ESD and Z-score methods)
- Seasonality handling
- Feature importance calculation
- Correlation analysis
- Edge cases (empty data, zero variance, negative values)
- Large dataset performance
- End-to-end workflows

## Database Schema

The service stores insights reports in the `analytics.insights_reports` table:

```sql
CREATE TABLE analytics.insights_reports (
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
```

Run the migration:
```bash
npm run migrate
```

## Security & HIPAA Compliance

The Insights API respects the same security and HIPAA compliance requirements as other analytics endpoints:

- **Authentication**: JWT-based authentication required
- **Authorization**: RBAC permissions (`VIEW_ANALYTICS`, `VIEW_FACILITY_ANALYTICS`)
- **Facility Scoping**: Users with `facilityId` only see their facility's data
- **HIPAA Compliance**: De-identification applied to results
- **Audit Logging**: All requests logged for compliance

## Performance Considerations

- **Time Series Size**: Optimized for up to 1,000 data points
- **Feature Count**: Handles up to 50 features efficiently
- **Computation Time**: < 5 seconds for typical datasets
- **Caching**: Reports cached in database for retrieval

## Algorithm Details

### ESD (Extreme Studentized Deviate)

Iteratively identifies outliers by:
1. Computing test statistic for maximum deviation
2. Comparing to critical value from t-distribution
3. Removing outlier and repeating
4. Stopping when no more outliers found

### Z-Score Method

Identifies outliers by:
1. Removing seasonal component
2. Computing z-score: `(value - mean) / stdDev`
3. Flagging values where `|z-score| > threshold`

### Feature Importance

Calculated as:
```
importance = correlation * (0.7 + 0.3 * normalizedVariance)
contribution = correlation * (featureStdDev / targetStdDev)
```

## Future Enhancements

Potential improvements for future iterations:
- Additional anomaly detection methods (Isolation Forest, LSTM)
- Time series forecasting
- Automated alerting for high-severity anomalies
- Interactive visualization of insights
- Custom threshold configuration per metric
- Anomaly explanation with root cause analysis

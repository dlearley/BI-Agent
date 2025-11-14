import { test, expect } from '@playwright/test';

test.describe('Forecast API', () => {
  const authHeaders = {
    'Authorization': 'Bearer mock-jwt-token',
    'Content-Type': 'application/json'
  };

  test.beforeEach(async ({ request }) => {
    // Mock authentication middleware for testing
    // In a real scenario, you'd have proper authentication setup
  });

  test('should get available forecast metrics', async ({ request }) => {
    const response = await request.get('/api/v1/forecast/metrics/available', {
      headers: authHeaders
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toContain('revenue');
    expect(data.data).toContain('pipeline_count');
    expect(data.data).toContain('time_to_fill');
  });

  test('should get available forecast models', async ({ request }) => {
    const response = await request.get('/api/v1/forecast/models/available', {
      headers: authHeaders
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data).toContain('prophet');
    expect(data.data).toContain('arima');
    expect(data.data).toContain('xgboost');
  });

  test('should create a forecast successfully', async ({ request }) => {
    const forecastRequest = {
      metric: 'revenue',
      model: 'prophet',
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-12-31T00:00:00.000Z',
      horizon: 30,
      frequency: 'daily',
      assumptions: {
        growthRate: 0.05,
        seasonality: 0.1
      },
      backtest: {
        enabled: true,
        testPeriods: 30
      }
    };

    // Mock the ML service call by intercepting the request
    await request.route('**/forecast', async route => {
      // Mock ML service response
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-forecast-id',
          metric: 'revenue',
          model: 'prophet',
          predictions: [
            {
              date: '2024-01-01',
              value: 10000,
              confidenceInterval: {
                lower: 9000,
                upper: 11000
              }
            }
          ],
          backtest: {
            mae: 500,
            rmse: 600,
            mape: 0.05,
            r2: 0.95,
            actualVsPredicted: [
              {
                date: '2023-12-01',
                actual: 9500,
                predicted: 9600
              }
            ]
          },
          assumptions: {
            growthRate: 0.05,
            seasonality: 0.1
          },
          metadata: {
            createdAt: new Date().toISOString(),
            modelAccuracy: 0.95,
            dataPoints: 365
          }
        })
      });
    });

    const response = await request.post('/api/v1/forecast/', {
      headers: authHeaders,
      data: forecastRequest
    });
    
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.metric).toBe('revenue');
    expect(data.data.model).toBe('prophet');
    expect(data.data.predictions).toBeDefined();
    expect(data.data.backtest).toBeDefined();
    expect(data.data.metadata).toBeDefined();
  });

  test('should validate forecast request data', async ({ request }) => {
    const invalidRequest = {
      metric: 'invalid_metric',
      model: 'prophet',
      startDate: 'invalid-date',
      endDate: '2023-12-31T00:00:00.000Z',
      horizon: -1,
      frequency: 'invalid-frequency'
    };

    const response = await request.post('/api/v1/forecast/', {
      headers: authHeaders,
      data: invalidRequest
    });
    
    expect(response.status()).toBe(400);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Validation error');
    expect(data.details).toBeDefined();
  });

  test('should create a forecast scenario', async ({ request }) => {
    // First create a forecast
    const forecastRequest = {
      metric: 'pipeline_count',
      model: 'arima',
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-12-31T00:00:00.000Z',
      horizon: 60,
      frequency: 'weekly'
    };

    // Mock the ML service call
    await request.route('**/forecast', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'mock-forecast-id-2',
          metric: 'pipeline_count',
          model: 'arima',
          predictions: [
            {
              date: '2024-01-07',
              value: 150,
              confidenceInterval: {
                lower: 130,
                upper: 170
              }
            }
          ],
          assumptions: {},
          metadata: {
            createdAt: new Date().toISOString(),
            modelAccuracy: 0.88,
            dataPoints: 52
          }
        })
      });
    });

    const forecastResponse = await request.post('/api/v1/forecast/', {
      headers: authHeaders,
      data: forecastRequest
    });

    const forecastData = await forecastResponse.json();
    const forecastId = forecastData.data.id;

    // Now create a scenario
    const scenarioRequest = {
      forecastId: forecastId,
      name: 'Q1 2024 Pipeline Projection',
      description: 'Optimistic scenario for Q1 2024 pipeline growth',
      assumptions: {
        growthRate: 0.15,
        seasonality: 0.2,
        externalFactors: {
          marketing_spend_increase: 0.3
        }
      },
      isReport: true
    };

    const scenarioResponse = await request.post('/api/v1/forecast/scenarios', {
      headers: authHeaders,
      data: scenarioRequest
    });

    expect(scenarioResponse.ok()).toBeTruthy();
    expect(scenarioResponse.status()).toBe(201);

    const scenarioData = await scenarioResponse.json();
    expect(scenarioData.success).toBe(true);
    expect(scenarioData.data).toHaveProperty('id');
    expect(scenarioData.data.name).toBe('Q1 2024 Pipeline Projection');
    expect(scenarioData.data.forecastId).toBe(forecastId);
    expect(scenarioData.data.isReport).toBe(true);
  });

  test('should retrieve forecast scenarios', async ({ request }) => {
    const response = await request.get('/api/v1/forecast/scenarios/list?includeReports=true', {
      headers: authHeaders
    });

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should return 404 for non-existent forecast', async ({ request }) => {
    const response = await request.get('/api/v1/forecast/non-existent-id', {
      headers: authHeaders
    });

    expect(response.status()).toBe(404);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Forecast not found');
  });

  test('should handle ML service errors gracefully', async ({ request }) => {
    const forecastRequest = {
      metric: 'revenue',
      model: 'xgboost',
      startDate: '2023-01-01T00:00:00.000Z',
      endDate: '2023-12-31T00:00:00.000Z',
      horizon: 30,
      frequency: 'daily'
    };

    // Mock ML service error
    await request.route('**/forecast', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'ML service internal error'
        })
      });
    });

    const response = await request.post('/api/v1/forecast/', {
      headers: authHeaders,
      data: forecastRequest
    });

    expect(response.status()).toBe(500);
    
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Failed to create forecast');
  });
});
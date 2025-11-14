import { test, expect } from '@playwright/test';

test.describe('Forecast API Mock Tests', () => {
  test('should validate forecast API structure', async ({ request }) => {
    // Test that the forecast endpoints are properly configured
    const healthResponse = await request.get('/health');
    expect(healthResponse.ok()).toBeTruthy();

    // Test forecast metrics endpoint (will fail with auth, but should show route exists)
    const metricsResponse = await request.get('/api/v1/forecast/metrics/available');
    // Should return 401 for missing auth, not 404
    expect(metricsResponse.status()).toBe(401);

    // Test forecast models endpoint
    const modelsResponse = await request.get('/api/v1/forecast/models/available');
    expect(modelsResponse.status()).toBe(401);

    // Test forecast creation endpoint
    const createResponse = await request.post('/api/v1/forecast/', {
      data: {}
    });
    expect(createResponse.status()).toBe(401);
  });

  test('should serve forecast UI', async ({ request }) => {
    // Test that the forecast UI is served
    const uiResponse = await request.get('/forecast');
    expect(uiResponse.ok()).toBeTruthy();
    expect(uiResponse.headers()['content-type']).toContain('text/html');
    
    const html = await uiResponse.text();
    expect(html).toContain('Forecast Sandbox');
    expect(html).toContain('metric to forecast');
  });

  test('should serve JavaScript files', async ({ request }) => {
    // Test that the JavaScript file is served
    const jsResponse = await request.get('/js/forecast.js');
    expect(jsResponse.ok()).toBeTruthy();
    expect(jsResponse.headers()['content-type']).toContain('application/javascript');
    
    const js = await jsResponse.text();
    expect(js).toContain('ForecastSandbox');
    expect(js).toContain('generateForecast');
  });
});
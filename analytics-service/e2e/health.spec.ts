import { test, expect } from '@playwright/test';

test.describe('Health Check', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get('/health');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });

  test('should return analytics health status', async ({ request }) => {
    const response = await request.get('/api/v1/analytics/health');
    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
  });
});

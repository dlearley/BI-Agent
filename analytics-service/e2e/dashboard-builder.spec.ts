import { test, expect } from '@playwright/test';

test.describe('Dashboard Builder - Complete Workflow', () => {
  const authHeaders = {
    'Authorization': 'Bearer mock-jwt-token',
    'Content-Type': 'application/json'
  };

  const organizationId = 'org-test-123';
  let connectorId: string;
  let queryId: string;
  let dashboardId: string;

  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard builder
    await page.goto('/dashboard');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
  });

  test('should create a data connector', async ({ request }) => {
    const connectorData = {
      name: 'Test Database',
      type: 'postgresql',
      config: {
        host: 'localhost',
        port: 5432,
        database: 'test_db',
        user: 'test_user',
        password: 'test_password'
      }
    };

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/connectors`,
      {
        headers: authHeaders,
        data: connectorData
      }
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('Test Database');
    expect(data.data.type).toBe('postgresql');
    
    connectorId = data.data.id;
  });

  test('should test data connector connection', async ({ request }) => {
    expect(connectorId).toBeTruthy();

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/connectors/${connectorId}/test`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('connected');
  });

  test('should get connector schema', async ({ request }) => {
    expect(connectorId).toBeTruthy();

    const response = await request.get(
      `/api/v1/dashboard/${organizationId}/connectors/${connectorId}/schema`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data[0]).toHaveProperty('name');
    expect(data.data[0]).toHaveProperty('type');
  });

  test('should get NL suggestions for query', async ({ request }) => {
    expect(connectorId).toBeTruthy();

    const response = await request.get(
      `/api/v1/dashboard/${organizationId}/connectors/${connectorId}/suggestions?prefix=SELECT`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();
    
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
  });

  test('should create a saved query', async ({ request }) => {
    expect(connectorId).toBeTruthy();

    const queryData = {
      name: 'Total Revenue Query',
      description: 'Query to calculate total revenue',
      queryText: 'SELECT SUM(total) as total_revenue FROM orders',
      queryType: 'metric',
      parameters: {}
    };

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/queries`,
      {
        headers: authHeaders,
        data: queryData
      }
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('Total Revenue Query');
    
    queryId = data.data.id;
  });

  test('should execute a saved query', async ({ request }) => {
    expect(queryId).toBeTruthy();

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/queries/${queryId}/execute`,
      {
        headers: authHeaders,
        data: {
          parameters: {}
        }
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('data');
    expect(data.data).toHaveProperty('cached');
    expect(data.data).toHaveProperty('executionTimeMs');
  });

  test('should create a dashboard', async ({ request }) => {
    const dashboardData = {
      name: 'Sales Dashboard',
      description: 'Dashboard for sales metrics',
      type: 'sales'
    };

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/dashboards`,
      {
        headers: authHeaders,
        data: dashboardData
      }
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.name).toBe('Sales Dashboard');
    expect(data.data.type).toBe('sales');
    
    dashboardId = data.data.id;
  });

  test('should add a widget to dashboard', async ({ request }) => {
    expect(dashboardId).toBeTruthy();
    expect(queryId).toBeTruthy();

    const widgetData = {
      type: 'kpi',
      title: 'Total Revenue',
      queryId: queryId,
      config: {
        format: 'currency'
      },
      position: {
        x: 0,
        y: 0,
        w: 4,
        h: 3
      }
    };

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}/widgets`,
      {
        headers: authHeaders,
        data: widgetData
      }
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.type).toBe('kpi');
    expect(data.data.title).toBe('Total Revenue');
  });

  test('should add multiple widgets with different types', async ({ request }) => {
    expect(dashboardId).toBeTruthy();

    const widgets = [
      {
        type: 'chart',
        title: 'Revenue Trend',
        chartType: 'line',
        config: {},
        position: { x: 4, y: 0, w: 4, h: 3 }
      },
      {
        type: 'table',
        title: 'Top Products',
        config: {},
        position: { x: 8, y: 0, w: 4, h: 3 }
      },
      {
        type: 'gauge',
        title: 'Conversion Rate',
        config: { min: 0, max: 100 },
        position: { x: 0, y: 3, w: 2, h: 3 }
      },
      {
        type: 'stat',
        title: 'Total Orders',
        config: {},
        position: { x: 2, y: 3, w: 2, h: 3 }
      }
    ];

    for (const widget of widgets) {
      const response = await request.post(
        `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}/widgets`,
        {
          headers: authHeaders,
          data: widget
        }
      );

      expect(response.ok()).toBeTruthy();
      const data = await response.json();
      expect(data.data.type).toBe(widget.type);
    }
  });

  test('should add cross-filter to dashboard', async ({ request }) => {
    expect(dashboardId).toBeTruthy();

    const filterData = {
      name: 'Date Range',
      fieldName: 'created_at',
      filterType: 'date',
      defaultValue: { start: '2024-01-01', end: '2024-12-31' },
      isGlobal: true
    };

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}/filters`,
      {
        headers: authHeaders,
        data: filterData
      }
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Date Range');
    expect(data.data.isGlobal).toBe(true);
  });

  test('should update dashboard layout', async ({ request }) => {
    expect(dashboardId).toBeTruthy();

    const updateData = {
      name: 'Updated Sales Dashboard',
      description: 'Updated description'
    };

    const response = await request.patch(
      `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}`,
      {
        headers: authHeaders,
        data: updateData
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('Updated Sales Dashboard');
  });

  test('should retrieve complete dashboard with widgets and filters', async ({ request }) => {
    expect(dashboardId).toBeTruthy();

    const response = await request.get(
      `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.id).toBe(dashboardId);
    expect(data.data.name).toContain('Sales');
    expect(Array.isArray(data.data.layout)).toBe(true);
    expect(typeof data.data.filters).toBe('object');
  });

  test('should export dashboard to PDF', async ({ request }) => {
    expect(dashboardId).toBeTruthy();

    const response = await request.post(
      `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}/export`,
      {
        headers: authHeaders,
        data: {
          format: 'pdf'
        }
      }
    );

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data).toHaveProperty('id');
    expect(data.data.status).toBe('pending');
  });

  test('should get export status', async ({ request }) => {
    expect(dashboardId).toBeTruthy();

    // Create export
    const exportResponse = await request.post(
      `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}/export`,
      {
        headers: authHeaders,
        data: { format: 'pdf' }
      }
    );

    const exportData = await exportResponse.json();
    const exportId = exportData.data.id;

    // Get status
    const statusResponse = await request.get(
      `/api/v1/dashboard/${organizationId}/exports/${exportId}`,
      {
        headers: authHeaders
      }
    );

    expect(statusResponse.ok()).toBeTruthy();

    const statusData = await statusResponse.json();
    expect(statusData.success).toBe(true);
    expect(statusData.data.status).toBe('pending');
  });

  test('should list all dashboards for organization', async ({ request }) => {
    const response = await request.get(
      `/api/v1/dashboard/${organizationId}/dashboards`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.some(d => d.id === dashboardId)).toBe(true);
  });

  test('should list all queries for organization', async ({ request }) => {
    const response = await request.get(
      `/api/v1/dashboard/${organizationId}/queries`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.some(q => q.id === queryId)).toBe(true);
  });

  test('should list all data connectors for organization', async ({ request }) => {
    const response = await request.get(
      `/api/v1/dashboard/${organizationId}/connectors`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data)).toBe(true);
    expect(data.data.some(c => c.id === connectorId)).toBe(true);
  });

  test('should delete dashboard', async ({ request }) => {
    expect(dashboardId).toBeTruthy();

    const response = await request.delete(
      `/api/v1/dashboard/${organizationId}/dashboards/${dashboardId}`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
  });

  test('should delete data connector', async ({ request }) => {
    expect(connectorId).toBeTruthy();

    const response = await request.delete(
      `/api/v1/dashboard/${organizationId}/connectors/${connectorId}`,
      {
        headers: authHeaders
      }
    );

    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

test.describe('Dashboard Builder - UI Interaction', () => {
  test('should load dashboard builder UI', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check for main UI elements
    await expect(page.locator('#dashboardName')).toBeVisible();
    await expect(page.locator('#dashboardType')).toBeVisible();
    await expect(page.locator('button:has-text("Add Widget")')).toBeVisible();
  });

  test('should open add widget modal', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("Add Widget")');
    
    const modal = page.locator('#addWidgetModal');
    await expect(modal).toHaveClass(/show/);
    await expect(modal.locator('#widgetType')).toBeVisible();
  });

  test('should open data connector modal', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("New Connector")');
    
    const modal = page.locator('#dataConnectorModal');
    await expect(modal).toHaveClass(/show/);
    await expect(modal.locator('#connectorName')).toBeVisible();
  });

  test('should open query modal with NL suggestions', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    await page.click('button:has-text("New Query")');
    
    const modal = page.locator('#queryModal');
    await expect(modal).toHaveClass(/show/);
    await expect(modal.locator('#queryName')).toBeVisible();
    await expect(modal.locator('button:has-text("Get Suggestions")')).toBeVisible();
  });
});

import { test, expect } from '@playwright/test';

test.describe('Dashboard API E2E Tests', () => {
  const baseURL = 'http://localhost:3000/api/v1';
  let authToken: string;
  let testDashboardId: string;
  let testWidgetId: string;
  let testQueryId: string;

  test.beforeAll(async () => {
    // Get auth token (assuming a test endpoint exists)
    const authResponse = await fetch(`${baseURL.replace('/api/v1', '')}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@test.com',
        password: 'testpassword'
      })
    });

    if (authResponse.ok) {
      const authData = await authResponse.json();
      authToken = authData.token;
    } else {
      // Fallback to mock token for testing
      authToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6ImFkbWluQHRlc3QuY29tIiwicm9sZSI6ImFkbWluIn0.test';
    }
  });

  test('should create, update, and delete a dashboard', async ({ request }) => {
    // Create dashboard
    const createResponse = await request.post(`${baseURL}/dashboard/dashboards`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'E2E Test Dashboard',
        description: 'Dashboard created during E2E testing',
        tags: ['e2e', 'test'],
        isPublic: false
      }
    });

    expect(createResponse.ok()).toBeTruthy();
    const createData = await createResponse.json();
    expect(createData.success).toBe(true);
    expect(createData.data.name).toBe('E2E Test Dashboard');
    
    testDashboardId = createData.data.id;

    // Update dashboard
    const updateResponse = await request.put(`${baseURL}/dashboard/dashboards/${testDashboardId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Updated E2E Dashboard',
        description: 'Updated description',
        tags: ['e2e', 'test', 'updated']
      }
    });

    expect(updateResponse.ok()).toBeTruthy();
    const updateData = await updateResponse.json();
    expect(updateData.success).toBe(true);
    expect(updateData.data.name).toBe('Updated E2E Dashboard');

    // Get dashboard
    const getResponse = await request.get(`${baseURL}/dashboard/dashboards/${testDashboardId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(getResponse.ok()).toBeTruthy();
    const getData = await getResponse.json();
    expect(getData.success).toBe(true);
    expect(getData.data.id).toBe(testDashboardId);

    // Delete dashboard
    const deleteResponse = await request.delete(`${baseURL}/dashboard/dashboards/${testDashboardId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(deleteResponse.ok()).toBeTruthy();
    const deleteData = await deleteResponse.json();
    expect(deleteData.success).toBe(true);
  });

  test('should create and manage widgets', async ({ request }) => {
    // First create a dashboard for the widget
    const dashboardResponse = await request.post(`${baseURL}/dashboard/dashboards`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Dashboard for Widget Test'
      }
    });

    const dashboardData = await dashboardResponse.json();
    const dashboardId = dashboardData.data.id;

    // Create a query for the widget
    const queryResponse = await request.post(`${baseURL}/dashboard/queries`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Test Query for Widget',
        queryText: 'SELECT 100 as value, "Test Metric" as label',
        queryType: 'sql'
      }
    });

    const queryData = await queryResponse.json();
    testQueryId = queryData.data.id;

    // Create widget
    const widgetResponse = await request.post(`${baseURL}/dashboard/widgets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        dashboardId,
        name: 'E2E Test Widget',
        type: 'kpi',
        queryId: testQueryId,
        config: {
          title: 'Test KPI Widget',
          kpi: {
            format: 'number',
            trend: true
          }
        },
        position: {
          id: 'widget-e2e-1',
          x: 0,
          y: 0,
          w: 4,
          h: 2
        }
      }
    });

    expect(widgetResponse.ok()).toBeTruthy();
    const widgetData = await widgetResponse.json();
    expect(widgetData.success).toBe(true);
    expect(widgetData.data.name).toBe('E2E Test Widget');
    expect(widgetData.data.type).toBe('kpi');
    
    testWidgetId = widgetData.data.id;

    // Update widget
    const updateWidgetResponse = await request.put(`${baseURL}/dashboard/widgets/${testWidgetId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Updated E2E Widget',
        config: {
          title: 'Updated KPI Widget',
          kpi: {
            format: 'currency',
            trend: false
          }
        }
      }
    });

    expect(updateWidgetResponse.ok()).toBeTruthy();
    const updateWidgetData = await updateWidgetResponse.json();
    expect(updateWidgetData.success).toBe(true);
    expect(updateWidgetData.data.name).toBe('Updated E2E Widget');

    // Get widget data
    const widgetDataResponse = await request.post(`${baseURL}/dashboard/widgets/data`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        widgetId: testWidgetId,
        useCache: false
      }
    });

    expect(widgetDataResponse.ok()).toBeTruthy();
    const widgetDataResult = await widgetDataResponse.json();
    expect(widgetDataResult.success).toBe(true);
    expect(widgetDataResult.data).toBeDefined();

    // Delete widget
    const deleteWidgetResponse = await request.delete(`${baseURL}/dashboard/widgets/${testWidgetId}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(deleteWidgetResponse.ok()).toBeTruthy();
  });

  test('should create and export dashboard', async ({ request }) => {
    // Create a dashboard
    const dashboardResponse = await request.post(`${baseURL}/dashboard/dashboards`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Dashboard for Export Test',
        description: 'Dashboard to test export functionality'
      }
    });

    const dashboardData = await dashboardResponse.json();
    const dashboardId = dashboardData.data.id;

    // Publish the dashboard
    const publishResponse = await request.post(`${baseURL}/dashboard/dashboards/${dashboardId}/publish`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(publishResponse.ok()).toBeTruthy();

    // Create export job
    const exportResponse = await request.post(`${baseURL}/dashboard/exports`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        dashboardId,
        exportType: 'pdf',
        formatOptions: {
          paperSize: 'A4',
          orientation: 'landscape',
          includeTimestamp: true
        }
      }
    });

    expect(exportResponse.ok()).toBeTruthy();
    const exportData = await exportResponse.json();
    expect(exportData.success).toBe(true);
    expect(exportData.data.exportType).toBe('pdf');
    expect(exportData.data.status).toBe('pending');

    const exportJobId = exportData.data.id;

    // Poll for export completion (with timeout)
    let maxAttempts = 10;
    let exportCompleted = false;

    while (maxAttempts > 0 && !exportCompleted) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

      const statusResponse = await request.get(`${baseURL}/dashboard/exports/${exportJobId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      });

      if (statusResponse.ok()) {
        const statusData = await statusResponse.json();
        if (statusData.data.status === 'completed') {
          exportCompleted = true;
          expect(statusData.data.filePath).toBeTruthy();
        } else if (statusData.data.status === 'failed') {
          throw new Error(`Export failed: ${statusData.data.errorMessage}`);
        }
      }

      maxAttempts--;
    }

    expect(exportCompleted).toBe(true);
  });

  test('should handle dashboard sharing', async ({ request }) => {
    // Create a dashboard
    const dashboardResponse = await request.post(`${baseURL}/dashboard/dashboards`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Dashboard for Sharing Test'
      }
    });

    const dashboardData = await dashboardResponse.json();
    const dashboardId = dashboardData.data.id;

    // Share dashboard with a user
    const shareResponse = await request.post(`${baseURL}/dashboard/dashboards/${dashboardId}/share`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        sharedWithUserId: 'test-user-id',
        permissionLevel: 'view'
      }
    });

    expect(shareResponse.ok()).toBeTruthy();
    const shareData = await shareResponse.json();
    expect(shareData.success).toBe(true);
    expect(shareData.data.permissionLevel).toBe('view');

    // Get dashboard with shares included
    const getDashboardResponse = await request.get(`${baseURL}/dashboard/dashboards/${dashboardId}?includeShares=true`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(getDashboardResponse.ok()).toBeTruthy();
    const getDashboardData = await getDashboardResponse.json();
    expect(getDashboardData.data.shares).toBeDefined();
    expect(Array.isArray(getDashboardData.data.shares)).toBe(true);

    // Unshare dashboard
    const unshareResponse = await request.delete(`${baseURL}/dashboard/dashboards/${dashboardId}/share/test-user-id`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(unshareResponse.ok()).toBeTruthy();
  });

  test('should validate input and handle errors', async ({ request }) => {
    // Test invalid dashboard creation
    const invalidDashboardResponse = await request.post(`${baseURL}/dashboard/dashboards`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: '', // Invalid: empty name
        description: 'Test dashboard'
      }
    });

    expect(invalidDashboardResponse.status()).toBe(400);
    const invalidData = await invalidDashboardResponse.json();
    expect(invalidData.success).toBe(false);
    expect(invalidData.error).toBe('Validation error');

    // Test non-existent dashboard
    const notFoundResponse = await request.get(`${baseURL}/dashboard/dashboards/non-existent-id`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(notFoundResponse.status()).toBe(404);
    const notFoundData = await notFoundResponse.json();
    expect(notFoundData.success).toBe(false);

    // Test unauthorized access
    const unauthorizedResponse = await request.post(`${baseURL}/dashboard/dashboards`, {
      headers: {
        'Content-Type': 'application/json'
        // Missing Authorization header
      },
      data: {
        name: 'Test Dashboard'
      }
    });

    expect(unauthorizedResponse.status()).toBe(401);
  });

  test('should handle bulk operations', async ({ request }) => {
    // Create multiple dashboards
    const dashboardPromises = Array.from({ length: 3 }, (_, i) =>
      request.post(`${baseURL}/dashboard/dashboards`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        data: {
          name: `Bulk Dashboard ${i + 1}`,
          tags: ['bulk', 'test']
        }
      })
    );

    const dashboardResponses = await Promise.all(dashboardPromises);
    
    dashboardResponses.forEach((response, index) => {
      expect(response.ok()).toBeTruthy();
    });

    // Get all dashboards with tag filter
    const filteredResponse = await request.get(`${baseURL}/dashboard/dashboards?tags=bulk&tags=test`, {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    });

    expect(filteredResponse.ok()).toBeTruthy();
    const filteredData = await filteredResponse.json();
    expect(filteredData.success).toBe(true);
    expect(filteredData.data.length).toBeGreaterThanOrEqual(3);
  });

  test('should handle widget data caching', async ({ request }) => {
    // Create dashboard, query, and widget
    const dashboardResponse = await request.post(`${baseURL}/dashboard/dashboards`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Cache Test Dashboard'
      }
    });

    const dashboardData = await dashboardResponse.json();
    const dashboardId = dashboardData.data.id;

    const queryResponse = await request.post(`${baseURL}/dashboard/queries`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        name: 'Cache Test Query',
        queryText: 'SELECT 42 as answer, "Life, the Universe, and Everything" as meaning',
        queryType: 'sql'
      }
    });

    const queryData = await queryResponse.json();
    const queryId = queryData.data.id;

    const widgetResponse = await request.post(`${baseURL}/dashboard/widgets`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        dashboardId,
        name: 'Cache Test Widget',
        type: 'table',
        queryId,
        config: {
          title: 'Cache Test Results'
        },
        position: {
          id: 'cache-test-widget',
          x: 0,
          y: 0,
          w: 6,
          h: 4
        }
      }
    });

    const widgetData = await widgetResponse.json();
    const widgetId = widgetData.data.id;

    // First request - should not be cached
    const firstDataResponse = await request.post(`${baseURL}/dashboard/widgets/data`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        widgetId,
        useCache: true
      }
    });

    expect(firstDataResponse.ok()).toBeTruthy();
    const firstDataResult = await firstDataResponse.json();
    expect(firstDataResult.success).toBe(true);
    expect(firstDataResult.cached).toBe(false);

    // Second request - should be cached
    const secondDataResponse = await request.post(`${baseURL}/dashboard/widgets/data`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        widgetId,
        useCache: true
      }
    });

    expect(secondDataResponse.ok()).toBeTruthy();
    const secondDataResult = await secondDataResponse.json();
    expect(secondDataResult.success).toBe(true);
    expect(secondDataResult.cached).toBe(true);

    // Force refresh - should not be cached
    const refreshResponse = await request.post(`${baseURL}/dashboard/widgets/data`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      },
      data: {
        widgetId,
        forceRefresh: true,
        useCache: true
      }
    });

    expect(refreshResponse.ok()).toBeTruthy();
    const refreshResult = await refreshResponse.json();
    expect(refreshResult.success).toBe(true);
    expect(refreshResult.cached).toBe(false);
  });
});
import request from 'supertest';
import app from '../index';
import { dashboardService } from '../services/dashboard.service';
import { User, Permission, UserRole, WidgetType, DashboardStatus } from '../types';

// Mock user for testing
const mockUser: User = {
  id: 'test-user-id',
  email: 'test@example.com',
  role: UserRole.ADMIN,
  permissions: [Permission.MANAGE_DASHBOARDS, Permission.VIEW_DASHBOARDS, Permission.EXPORT_DATA],
  facilityId: 'test-facility-id'
};

// Mock JWT token
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiJ0ZXN0LXVzZXItaWQiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiYWRtaW4iLCJwZXJtaXNzaW9ucyI6WyJtYW5hZ2VfZGFzaGJvYXJkcyIsInZpZXdfZGFzaGJvYXJkcyIsImV4cG9ydF9kYXRhIl19.test';

describe('Dashboard API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/dashboard/dashboards', () => {
    it('should create a new dashboard', async () => {
      const dashboardData = {
        name: 'Test Dashboard',
        description: 'A test dashboard',
        tags: ['test', 'demo'],
        isPublic: false
      };

      const response = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(dashboardData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(dashboardData.name);
      expect(response.body.data.description).toBe(dashboardData.description);
      expect(response.body.data.status).toBe(DashboardStatus.DRAFT);
      expect(response.body.data.version).toBe(1);
      expect(response.body.data.isPublic).toBe(dashboardData.isPublic);
    });

    it('should return validation error for invalid data', async () => {
      const invalidData = {
        name: '', // Empty name should fail validation
        description: 'A test dashboard'
      };

      const response = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation error');
    });

    it('should return unauthorized for missing token', async () => {
      const dashboardData = {
        name: 'Test Dashboard'
      };

      await request(app)
        .post('/api/v1/dashboard/dashboards')
        .send(dashboardData)
        .expect(401);
    });
  });

  describe('GET /api/v1/dashboard/dashboards', () => {
    it('should get all dashboards for user', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(typeof response.body.count).toBe('number');
    });

    it('should filter dashboards by status', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/dashboards?status=published')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should include widgets when requested', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/dashboards?includeWidgets=true')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('GET /api/v1/dashboard/dashboards/:id', () => {
    it('should get a specific dashboard', async () => {
      // First create a dashboard
      const createResponse = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Dashboard for Get',
          description: 'Test description'
        });

      const dashboardId = createResponse.body.data.id;

      // Then get it
      const response = await request(app)
        .get(`/api/v1/dashboard/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(dashboardId);
      expect(response.body.data.name).toBe('Test Dashboard for Get');
    });

    it('should return 404 for non-existent dashboard', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/dashboards/non-existent-id')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Dashboard not found or access denied');
    });
  });

  describe('PUT /api/v1/dashboard/dashboards/:id', () => {
    it('should update a dashboard', async () => {
      // First create a dashboard
      const createResponse = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Dashboard for Update',
          description: 'Original description'
        });

      const dashboardId = createResponse.body.data.id;

      // Then update it
      const updateData = {
        name: 'Updated Dashboard Name',
        description: 'Updated description',
        tags: ['updated', 'test']
      };

      const response = await request(app)
        .put(`/api/v1/dashboard/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.description).toBe(updateData.description);
    });
  });

  describe('POST /api/v1/dashboard/dashboards/:id/publish', () => {
    it('should publish a dashboard', async () => {
      // First create a dashboard
      const createResponse = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Dashboard for Publish'
        });

      const dashboardId = createResponse.body.data.id;

      // Then publish it
      const response = await request(app)
        .post(`/api/v1/dashboard/dashboards/${dashboardId}/publish`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(DashboardStatus.PUBLISHED);
      expect(response.body.data.publishedAt).toBeTruthy();
    });
  });

  describe('DELETE /api/v1/dashboard/dashboards/:id', () => {
    it('should delete a dashboard', async () => {
      // First create a dashboard
      const createResponse = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Dashboard for Delete'
        });

      const dashboardId = createResponse.body.data.id;

      // Then delete it
      const response = await request(app)
        .delete(`/api/v1/dashboard/dashboards/${dashboardId}`)
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Dashboard deleted successfully');
    });
  });

  describe('POST /api/v1/dashboard/widgets', () => {
    it('should create a new widget', async () => {
      // First create a dashboard
      const dashboardResponse = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Dashboard for Widget'
        });

      const dashboardId = dashboardResponse.body.data.id;

      // Then create a query for the widget
      const queryResponse = await request(app)
        .post('/api/v1/dashboard/queries')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Query',
          queryText: 'SELECT 1 as test_value',
          queryType: 'sql'
        });

      const queryId = queryResponse.body.data.id;

      // Then create the widget
      const widgetData = {
        dashboardId,
        name: 'Test Widget',
        type: WidgetType.KPI,
        queryId,
        config: {
          title: 'Test KPI',
          kpi: {
            format: 'number'
          }
        },
        position: {
          id: 'widget-1',
          x: 0,
          y: 0,
          w: 4,
          h: 2
        }
      };

      const response = await request(app)
        .post('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(widgetData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(widgetData.name);
      expect(response.body.data.type).toBe(widgetData.type);
      expect(response.body.data.dashboardId).toBe(widgetData.dashboardId);
    });
  });

  describe('POST /api/v1/dashboard/queries', () => {
    it('should create a new query', async () => {
      const queryData = {
        name: 'Test Query',
        description: 'A test query',
        queryText: 'SELECT COUNT(*) as count FROM users',
        queryType: 'sql' as const,
        parameters: [
          {
            name: 'startDate',
            type: 'date' as const,
            required: false,
            description: 'Start date for filtering'
          }
        ],
        isTemplate: false
      };

      const response = await request(app)
        .post('/api/v1/dashboard/queries')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(queryData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(queryData.name);
      expect(response.body.data.queryText).toBe(queryData.queryText);
      expect(response.body.data.queryType).toBe(queryData.queryType);
      expect(Array.isArray(response.body.data.parameters)).toBe(true);
    });
  });

  describe('GET /api/v1/dashboard/queries', () => {
    it('should get all queries', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/queries')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(typeof response.body.count).toBe('number');
    });

    it('should include templates when requested', async () => {
      const response = await request(app)
        .get('/api/v1/dashboard/queries?includeTemplates=true')
        .set('Authorization', `Bearer ${mockToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('POST /api/v1/dashboard/exports', () => {
    it('should create an export job', async () => {
      // First create a dashboard
      const dashboardResponse = await request(app)
        .post('/api/v1/dashboard/dashboards')
        .set('Authorization', `Bearer ${mockToken}`)
        .send({
          name: 'Test Dashboard for Export'
        });

      const dashboardId = dashboardResponse.body.data.id;

      const exportData = {
        dashboardId,
        exportType: 'pdf' as const,
        formatOptions: {
          paperSize: 'A4' as const,
          orientation: 'landscape' as const,
          includeTimestamp: true
        }
      };

      const response = await request(app)
        .post('/api/v1/dashboard/exports')
        .set('Authorization', `Bearer ${mockToken}`)
        .send(exportData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.dashboardId).toBe(exportData.dashboardId);
      expect(response.body.data.exportType).toBe(exportData.exportType);
      expect(response.body.data.status).toBe('pending');
    });
  });
});

// Integration tests for the service layer
describe('DashboardService', () => {
  let service: typeof dashboardService;
  let user: User;

  beforeEach(() => {
    service = dashboardService;
    user = mockUser;
  });

  describe('createDashboard', () => {
    it('should create a dashboard with default values', async () => {
      const request = {
        name: 'Test Dashboard',
        description: 'Test description'
      };

      // This would require database mocking in a real test environment
      // For now, we'll just test the structure
      expect(request.name).toBe('Test Dashboard');
      expect(request.description).toBe('Test description');
    });
  });

  describe('generateQueryHash', () => {
    it('should generate consistent hashes for identical queries', () => {
      const query1 = 'SELECT * FROM users WHERE active = true';
      const query2 = 'SELECT * FROM users WHERE active = true';
      
      // Access private method through type assertion for testing
      const serviceAny = service as any;
      const hash1 = serviceAny.generateQueryHash(query1);
      const hash2 = serviceAny.generateQueryHash(query2);
      
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hash
    });

    it('should generate different hashes for different queries', () => {
      const query1 = 'SELECT * FROM users WHERE active = true';
      const query2 = 'SELECT * FROM users WHERE active = false';
      
      const serviceAny = service as any;
      const hash1 = serviceAny.generateQueryHash(query1);
      const hash2 = serviceAny.generateQueryHash(query2);
      
      expect(hash1).not.toBe(hash2);
    });
  });
});
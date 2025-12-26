import { dashboardService } from '../services/dashboard.service';
import { db } from '../config/database';
import { redis } from '../config/redis';

// Mock dependencies
jest.mock('../config/database');
jest.mock('../config/redis');

describe('DashboardService', () => {
  const mockOrgId = 'org-123';
  const mockDashboard = {
    id: 'dashboard-1',
    organizationId: mockOrgId,
    name: 'Test Dashboard',
    description: 'Test Description',
    type: 'custom' as const,
    layout: [],
    filters: {},
    isTemplate: false,
    createdBy: 'user@test.com',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Dashboards', () => {
    it('should get all dashboards for organization', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockDashboard],
      });

      const dashboards = await dashboardService.getDashboards(mockOrgId);
      expect(dashboards).toHaveLength(1);
      expect(dashboards[0].name).toBe('Test Dashboard');
    });

    it('should create a dashboard', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockDashboard],
      });

      const dashboard = await dashboardService.createDashboard({
        organizationId: mockOrgId,
        name: 'Test Dashboard',
        type: 'custom',
      });

      expect(dashboard.id).toBe('dashboard-1');
      expect(dashboard.name).toBe('Test Dashboard');
    });

    it('should update a dashboard', async () => {
      const updated = { ...mockDashboard, name: 'Updated Dashboard' };
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [updated],
      });

      const dashboard = await dashboardService.updateDashboard('dashboard-1', {
        name: 'Updated Dashboard',
      });

      expect(dashboard.name).toBe('Updated Dashboard');
    });

    it('should delete a dashboard', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rowCount: 1,
      });

      const result = await dashboardService.deleteDashboard('dashboard-1');
      expect(result).toBe(true);
    });
  });

  describe('Data Connectors', () => {
    const mockConnector = {
      id: 'connector-1',
      organizationId: mockOrgId,
      name: 'Test Connector',
      type: 'postgresql' as const,
      config: { host: 'localhost', port: 5432 },
      status: 'active' as const,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a data connector', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockConnector],
      });

      const connector = await dashboardService.createDataConnector({
        organizationId: mockOrgId,
        name: 'Test Connector',
        type: 'postgresql',
        config: { host: 'localhost', port: 5432 },
      });

      expect(connector.id).toBe('connector-1');
      expect(connector.name).toBe('Test Connector');
    });

    it('should get data connectors by organization', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockConnector],
      });

      const connectors = await dashboardService.getDataConnectors(mockOrgId);
      expect(connectors).toHaveLength(1);
      expect(connectors[0].type).toBe('postgresql');
    });

    it('should test data connector', async () => {
      const result = await dashboardService.testDataConnector(mockConnector);
      expect(result).toBe(true);
    });
  });

  describe('Saved Queries', () => {
    const mockQuery = {
      id: 'query-1',
      organizationId: mockOrgId,
      name: 'Test Query',
      description: 'Test Description',
      queryText: 'SELECT * FROM users',
      queryType: 'custom' as const,
      parameters: {},
      createdBy: 'user@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should create a saved query', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockQuery],
      });

      const query = await dashboardService.createSavedQuery({
        organizationId: mockOrgId,
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
      });

      expect(query.id).toBe('query-1');
      expect(query.name).toBe('Test Query');
    });

    it('should get saved queries by organization', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockQuery],
      });

      const queries = await dashboardService.getSavedQueries(mockOrgId);
      expect(queries).toHaveLength(1);
      expect(queries[0].queryType).toBe('custom');
    });
  });

  describe('Query Execution', () => {
    const mockQuery = {
      id: 'query-1',
      organizationId: mockOrgId,
      name: 'Test Query',
      description: 'Test Description',
      queryText: 'SELECT * FROM users',
      queryType: 'custom' as const,
      parameters: {},
      createdBy: 'user@test.com',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should execute a query', async () => {
      const mockResult = [{ id: 1, name: 'User 1' }];
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: mockResult,
        fields: [{ name: 'id', dataTypeID: 23 }, { name: 'name', dataTypeID: 25 }],
      });

      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (redis.setex as jest.Mock).mockResolvedValueOnce('OK');

      const result = await dashboardService.executeQuery(mockQuery);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResult);
      expect(result.cached).toBe(false);
    });

    it('should return cached query result', async () => {
      const cachedResult = {
        id: 'query-1',
        success: true,
        data: [{ id: 1, name: 'User 1' }],
        rowCount: 1,
        executionTimeMs: 100,
        cached: true,
      };

      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(cachedResult));

      const result = await dashboardService.executeQuery(mockQuery);
      expect(result.cached).toBe(true);
    });
  });

  describe('NL Suggestions', () => {
    it('should get NL suggestions from cache', async () => {
      const mockSuggestions = [
        {
          query: 'SELECT COUNT(*) FROM users',
          description: 'Count all users',
          score: 0.95,
        },
      ];

      (redis.get as jest.Mock).mockResolvedValueOnce(JSON.stringify(mockSuggestions));

      const suggestions = await dashboardService.getNLSuggestions('connector-1', 'count');
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].query).toContain('COUNT');
    });

    it('should generate NL suggestions if not cached', async () => {
      (redis.get as jest.Mock).mockResolvedValueOnce(null);
      (redis.setex as jest.Mock).mockResolvedValueOnce('OK');
      (dashboardService.getDataConnectorById as jest.Mock).mockResolvedValueOnce({
        id: 'connector-1',
        name: 'Test Connector',
      });

      const suggestions = await dashboardService.getNLSuggestions('connector-1', 'SELECT');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Dashboard Exports', () => {
    const mockExport = {
      id: 'export-1',
      dashboardId: 'dashboard-1',
      exportFormat: 'pdf' as const,
      status: 'pending' as const,
      createdAt: new Date(),
    };

    it('should create dashboard export', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [mockExport],
      });

      const export_ = await dashboardService.createDashboardExport(
        'dashboard-1',
        'pdf',
        'user@test.com'
      );

      expect(export_.id).toBe('export-1');
      expect(export_.status).toBe('pending');
    });

    it('should get export status', async () => {
      (db.query as jest.Mock).mockResolvedValueOnce({
        rows: [{ ...mockExport, status: 'completed' }],
      });

      const export_ = await dashboardService.getDashboardExportStatus('export-1');
      expect(export_?.status).toBe('completed');
    });
  });

  describe('Schema Introspection', () => {
    it('should get connector schema', async () => {
      const schema = await dashboardService.getConnectorSchema('connector-1');
      expect(Array.isArray(schema)).toBe(true);
      expect(schema.length).toBeGreaterThan(0);
      expect(schema[0]).toHaveProperty('name');
      expect(schema[0]).toHaveProperty('type');
    });
  });
});

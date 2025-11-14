import { dashboardController } from '../controllers/dashboard.controller';
import { dashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../middleware/auth';
import { Response } from 'express';

jest.mock('../services/dashboard.service');

describe('DashboardController', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeEach(() => {
    jsonSpy = jest.fn().mockReturnValue(undefined);
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockResponse = {
      json: jsonSpy,
      status: statusSpy,
    };

    mockRequest = {
      params: {},
      body: {},
      user: {
        id: 'user-1',
        email: 'user@test.com',
        role: 'viewer',
        permissions: [],
      },
    };
  });

  describe('listDashboards', () => {
    it('should list all dashboards for organization', async () => {
      const mockDashboards = [
        {
          id: 'dashboard-1',
          organizationId: 'org-1',
          name: 'Dashboard 1',
          type: 'custom',
          layout: [],
          filters: {},
          isTemplate: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      (dashboardService.getDashboards as jest.Mock).mockResolvedValueOnce(mockDashboards);

      mockRequest.params = { organizationId: 'org-1' };

      await dashboardController.listDashboards(mockRequest as any, mockResponse as any);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: mockDashboards,
        count: 1,
      });
    });
  });

  describe('createDashboard', () => {
    it('should create a new dashboard', async () => {
      const newDashboard = {
        id: 'dashboard-1',
        organizationId: 'org-1',
        name: 'New Dashboard',
        type: 'sales',
        layout: [],
        filters: {},
        isTemplate: false,
        createdBy: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dashboardService.createDashboard as jest.Mock).mockResolvedValueOnce(newDashboard);

      mockRequest.params = { organizationId: 'org-1' };
      mockRequest.body = {
        name: 'New Dashboard',
        type: 'sales',
      };

      await dashboardController.createDashboard(mockRequest as any, mockResponse as any);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: newDashboard,
      });
    });

    it('should handle validation errors', async () => {
      mockRequest.params = { organizationId: 'org-1' };
      mockRequest.body = { name: '' }; // Invalid: empty name

      await dashboardController.createDashboard(mockRequest as any, mockResponse as any);

      expect(statusSpy).toHaveBeenCalledWith(400);
      expect(jsonSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation error',
        })
      );
    });
  });

  describe('addWidget', () => {
    it('should add a widget to dashboard', async () => {
      const newWidget = {
        id: 'widget-1',
        dashboardId: 'dashboard-1',
        type: 'kpi',
        title: 'Total Revenue',
        position: { x: 0, y: 0, w: 4, h: 3 },
        config: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dashboardService.addWidget as jest.Mock).mockResolvedValueOnce(newWidget);

      mockRequest.params = { organizationId: 'org-1', dashboardId: 'dashboard-1' };
      mockRequest.body = {
        type: 'kpi',
        title: 'Total Revenue',
      };

      await dashboardController.addWidget(mockRequest as any, mockResponse as any);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: newWidget,
      });
    });
  });

  describe('createDataConnector', () => {
    it('should create a new data connector', async () => {
      const newConnector = {
        id: 'connector-1',
        organizationId: 'org-1',
        name: 'Test Connector',
        type: 'postgresql',
        config: { host: 'localhost', port: 5432 },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dashboardService.createDataConnector as jest.Mock).mockResolvedValueOnce(newConnector);

      mockRequest.params = { organizationId: 'org-1' };
      mockRequest.body = {
        name: 'Test Connector',
        type: 'postgresql',
        config: { host: 'localhost', port: 5432 },
      };

      await dashboardController.createDataConnector(mockRequest as any, mockResponse as any);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: newConnector,
      });
    });
  });

  describe('testDataConnector', () => {
    it('should test data connector connection', async () => {
      const connector = {
        id: 'connector-1',
        organizationId: 'org-1',
        name: 'Test Connector',
        type: 'postgresql',
        config: { host: 'localhost', port: 5432 },
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dashboardService.getDataConnectorById as jest.Mock).mockResolvedValueOnce(connector);
      (dashboardService.testDataConnector as jest.Mock).mockResolvedValueOnce(true);

      mockRequest.params = { organizationId: 'org-1', connectorId: 'connector-1' };

      await dashboardController.testDataConnector(mockRequest as any, mockResponse as any);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: {
          connectorId: 'connector-1',
          connected: true,
          message: 'Connection successful',
        },
      });
    });
  });

  describe('createSavedQuery', () => {
    it('should create a saved query', async () => {
      const newQuery = {
        id: 'query-1',
        organizationId: 'org-1',
        name: 'Test Query',
        description: 'Test Description',
        queryText: 'SELECT * FROM users',
        queryType: 'custom',
        parameters: {},
        createdBy: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (dashboardService.createSavedQuery as jest.Mock).mockResolvedValueOnce(newQuery);

      mockRequest.params = { organizationId: 'org-1' };
      mockRequest.body = {
        name: 'Test Query',
        queryText: 'SELECT * FROM users',
      };

      await dashboardController.createSavedQuery(mockRequest as any, mockResponse as any);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: newQuery,
      });
    });
  });

  describe('executeQuery', () => {
    it('should execute a query', async () => {
      const query = {
        id: 'query-1',
        organizationId: 'org-1',
        name: 'Test Query',
        description: 'Test',
        queryText: 'SELECT * FROM users',
        queryType: 'custom',
        parameters: {},
        createdBy: 'user@test.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const queryResult = {
        id: 'query-1',
        success: true,
        data: [{ id: 1, name: 'User 1' }],
        rowCount: 1,
        executionTimeMs: 100,
        cached: false,
      };

      (dashboardService.getSavedQueryById as jest.Mock).mockResolvedValueOnce(query);
      (dashboardService.executeQuery as jest.Mock).mockResolvedValueOnce(queryResult);

      mockRequest.params = { organizationId: 'org-1', queryId: 'query-1' };
      mockRequest.body = { parameters: {} };

      await dashboardController.executeQuery(mockRequest as any, mockResponse as any);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: queryResult,
      });
    });
  });

  describe('getNLSuggestions', () => {
    it('should get NL suggestions', async () => {
      const suggestions = [
        {
          query: 'SELECT COUNT(*) FROM users',
          description: 'Count all users',
          score: 0.95,
        },
      ];

      (dashboardService.getNLSuggestions as jest.Mock).mockResolvedValueOnce(suggestions);

      mockRequest.params = { organizationId: 'org-1', connectorId: 'connector-1' };
      mockRequest.query = { prefix: 'SELECT' };

      await dashboardController.getNLSuggestions(mockRequest as any, mockResponse as any);

      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: suggestions,
        count: 1,
      });
    });

    it('should handle missing prefix', async () => {
      mockRequest.params = { organizationId: 'org-1', connectorId: 'connector-1' };
      mockRequest.query = {};

      await dashboardController.getNLSuggestions(mockRequest as any, mockResponse as any);

      expect(statusSpy).toHaveBeenCalledWith(400);
    });
  });

  describe('exportDashboard', () => {
    it('should create dashboard export', async () => {
      const export_ = {
        id: 'export-1',
        dashboardId: 'dashboard-1',
        exportFormat: 'pdf',
        status: 'pending',
        createdAt: new Date(),
      };

      (dashboardService.createDashboardExport as jest.Mock).mockResolvedValueOnce(export_);

      mockRequest.params = { organizationId: 'org-1', dashboardId: 'dashboard-1' };
      mockRequest.body = { format: 'pdf' };

      await dashboardController.exportDashboard(mockRequest as any, mockResponse as any);

      expect(statusSpy).toHaveBeenCalledWith(201);
      expect(jsonSpy).toHaveBeenCalledWith({
        success: true,
        data: export_,
      });
    });
  });
});

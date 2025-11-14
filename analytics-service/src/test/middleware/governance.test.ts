import { Request, Response, NextFunction } from 'express';
import { auditLogger, logAuditEntry, createSecurityContext } from '../../middleware/audit';
import { enhancedRBAC, facilityDataFilter, dataExportRestrictions } from '../../middleware/rbac';
import { UserRole, Permission } from '../../types';
import { governanceService } from '../../services/governance.service';

describe('Governance Middleware Tests', () => {
  let mockRequest: any;
  let mockResponse: any;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockRequest = {
      user: {
        id: 'test-user',
        email: 'test@example.com',
        role: UserRole.ADMIN,
        permissions: Object.values(Permission),
        facilityId: 'facility-1',
      },
      params: {},
      query: {},
      body: {},
      method: 'GET',
      originalUrl: '/api/v1/test',
      get: jest.fn(),
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn(),
    };

    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Audit Logger Middleware', () => {
    it('should create audit context for auditable requests', async () => {
      const middleware = auditLogger('test_action', 'test_resource');
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockRequest.auditContext).toBeDefined();
      expect(mockRequest.auditContext?.action).toBe('test_action');
      expect(mockRequest.auditContext?.resource).toBe('test_resource');
      expect(nextFunction).toHaveBeenCalled();
    });

    it('should skip audit logging when disabled', async () => {
      const middleware = auditLogger('test_action', 'test_resource');
      
      // Mock config to disable audit logging
      const originalConfig = require('../../config').default;
      require('../../config').default.governance.auditLog.enabled = false;

      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockRequest.auditContext).toBeUndefined();
      expect(nextFunction).toHaveBeenCalled();

      // Restore config
      require('../../config').default.governance.auditLog.enabled = originalConfig.governance.auditLog.enabled;
    });

    it('should intercept response.json for audit logging', async () => {
      const middleware = auditLogger('test_action', 'test_resource');
      const responseData = { success: true, data: 'test' };
      
      await middleware(mockRequest, mockResponse, nextFunction);

      // Call the intercepted json method
      mockResponse.json(responseData);

      expect(mockResponse.json).toHaveBeenCalledWith(responseData);
    });
  });

  describe('Enhanced RBAC Middleware', () => {
    it('should allow access with proper permissions', async () => {
      const middleware = enhancedRBAC([Permission.VIEW_ANALYTICS], 'hipaa');
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.securityContext).toBeDefined();
      expect(mockRequest.securityContext?.complianceFramework).toBe('hipaa');
    });

    it('should deny access without authentication', async () => {
      delete mockRequest.user;
      const middleware = enhancedRBAC([Permission.VIEW_ANALYTICS]);
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authentication required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should deny access with insufficient permissions', async () => {
      mockRequest.user.permissions = [Permission.VIEW_FACILITY_ANALYTICS];
      const middleware = enhancedRBAC([Permission.VIEW_ANALYTICS]);
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should apply row-level security filter', async () => {
      mockRequest.user.role = UserRole.RECRUITER;
      mockRequest.user.facilityId = 'facility-1';
      const middleware = enhancedRBAC([Permission.VIEW_ANALYTICS]);
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.rowLevelFilter).toContain('facility_id');
    });

    it('should apply column-level security filter', async () => {
      const middleware = enhancedRBAC([Permission.VIEW_ANALYTICS]);
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.columnLevelFilter).toBeDefined();
    });
  });

  describe('Facility Data Filter', () => {
    it('should allow admin access to all facilities', async () => {
      const middleware = facilityDataFilter;
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.rowLevelFilter).toBeUndefined();
    });

    it('should restrict recruiter to their facility', async () => {
      mockRequest.user.role = UserRole.RECRUITER;
      mockRequest.user.facilityId = 'facility-1';
      const middleware = facilityDataFilter;
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRequest.rowLevelFilter).toContain('facility-1');
    });

    it('should deny access for user without facility assignment', async () => {
      mockRequest.user.role = UserRole.RECRUITER;
      delete mockRequest.user.facilityId;
      const middleware = facilityDataFilter;
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Data Export Restrictions', () => {
    it('should allow export with proper permissions', async () => {
      mockRequest.user.permissions.push(Permission.EXPORT_DATA);
      mockRequest.query.limit = '100';
      const middleware = dataExportRestrictions;
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
    });

    it('should deny export without export permission', async () => {
      const middleware = dataExportRestrictions;
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should enforce record limits', async () => {
      mockRequest.user.permissions.push(Permission.EXPORT_DATA);
      mockRequest.query.limit = '5000'; // Exceeds default limit
      const middleware = dataExportRestrictions;
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should require approval for HIPAA exports', async () => {
      mockRequest.user.permissions.push(Permission.EXPORT_DATA);
      mockRequest.query.limit = '100';
      mockRequest.securityContext = {
        user: mockRequest.user,
        complianceFramework: 'hipaa',
        preset: {
          exportRestrictions: {
            enabled: true,
            approvalRequired: true,
            maxRecords: 1000,
          },
        } as any,
        auditRequired: true,
        piiAccess: false,
      };
      const middleware = dataExportRestrictions;
      
      await middleware(mockRequest, mockResponse, nextFunction);

      expect(mockResponse.status).toHaveBeenCalledWith(402);
      expect(nextFunction).not.toHaveBeenCalled();
    });
  });

  describe('Security Context Creation', () => {
    it('should create proper security context', async () => {
      const securityContext = createSecurityContext(mockRequest, 'hipaa');

      expect(securityContext.user).toBe(mockRequest.user);
      expect(securityContext.complianceFramework).toBe('hipaa');
      expect(securityContext.preset).toBeDefined();
      expect(securityContext.auditRequired).toBe(true);
    });

    it('should set PII access based on permissions', async () => {
      mockRequest.user.permissions = [Permission.VIEW_ANALYTICS]; // No VIEW_PII
      const securityContext = createSecurityContext(mockRequest, 'hipaa');

      expect(securityContext.piiAccess).toBe(false);
    });

    it('should allow PII access with proper permissions', async () => {
      mockRequest.user.permissions.push(Permission.VIEW_PII);
      const securityContext = createSecurityContext(mockRequest, 'hipaa');

      expect(securityContext.piiAccess).toBe(true);
    });
  });
});

describe('Audit Logging Integration', () => {
  it('should log audit entry successfully', async () => {
    const mockRequest = {
      user: {
        id: 'test-user',
        email: 'test@example.com',
        role: UserRole.ADMIN,
        permissions: Object.values(Permission),
        facilityId: 'facility-1',
      },
      auditContext: {
        action: 'test_action',
        resource: 'test_resource',
        resourceId: 'test-123',
        details: { test: 'data' },
      },
      get: jest.fn().mockReturnValue('Test-Agent'),
    };

    const mockResponse = {
      statusCode: 200,
    };

    // Mock the database query
    const mockQuery = jest.fn().mockResolvedValue([]);
    jest.doMock('../../config/database', () => ({
      db: { query: mockQuery },
    }));

    await logAuditEntry(mockRequest as any, mockResponse as any, { success: true });

    expect(mockQuery).toHaveBeenCalled();
  });
});

describe('Error Handling', () => {
  it('should handle RBAC errors gracefully', async () => {
    const mockRequest = {
      user: {
        id: 'test-user',
        email: 'test@example.com',
        role: UserRole.ADMIN,
        permissions: Object.values(Permission),
      },
    };

    const mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    const nextFunction = jest.fn();

    // Mock governance service to throw error
    jest.spyOn(governanceService, 'applyCompliancePreset').mockRejectedValue(new Error('Test error'));

    const middleware = enhancedRBAC([Permission.VIEW_ANALYTICS]);
    
    await middleware(mockRequest as any, mockResponse as any, nextFunction);

    expect(mockResponse.status).toHaveBeenCalledWith(500);
    expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Authorization check failed' });
    expect(nextFunction).not.toHaveBeenCalled();
  });
});
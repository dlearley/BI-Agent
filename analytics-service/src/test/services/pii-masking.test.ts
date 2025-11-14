import { piiMaskingService } from '../../services/pii-masking.service';
import { SecurityContext, UserRole, Permission } from '../../types';

describe('PII Masking Service Tests', () => {
  let mockSecurityContext: SecurityContext;
  let mockUser: any;

  beforeEach(() => {
    mockUser = {
      id: 'test-user',
      email: 'test@example.com',
      role: UserRole.VIEWER,
      permissions: [Permission.VIEW_ANALYTICS],
      facilityId: 'facility-1',
    };

    mockSecurityContext = {
      user: mockUser,
      complianceFramework: 'hipaa',
      preset: {
        name: 'HIPAA',
        description: 'HIPAA Compliance',
        dataRetention: 2555,
        piiMasking: {
          enabled: true,
          fields: ['email', 'phone', 'ssn', 'name', 'address'],
          maskingStrategy: 'full' as const,
        },
        auditRequirements: {
          logAllAccess: true,
          logDataChanges: true,
          logFailedAttempts: true,
        },
        exportRestrictions: {
          enabled: true,
          approvalRequired: true,
          maxRecords: 1000,
        },
      },
      auditRequired: true,
      piiAccess: false,
      facilityScope: 'facility-1',
    };
  });

  describe('Full Masking Strategy', () => {
    beforeEach(() => {
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'full';
    });

    it('should fully mask email addresses', () => {
      const testData = { email: 'user@example.com', name: 'John Doe' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe('***@***.***');
      expect(result.name).toBe('[REDACTED]');
    });

    it('should fully mask phone numbers', () => {
      const testData = { phone: '555-123-4567' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.phone).toBe('***-***-****');
    });

    it('should fully mask SSN', () => {
      const testData = { ssn: '123-45-6789' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.ssn).toBe('***-**-****');
    });

    it('should fully mask names', () => {
      const testData = { 
        firstName: 'John', 
        lastName: 'Doe', 
        fullName: 'John Doe' 
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.firstName).toBe('[REDACTED]');
      expect(result.lastName).toBe('[REDACTED]');
      expect(result.fullName).toBe('[REDACTED]');
    });

    it('should fully mask addresses', () => {
      const testData = { address: '123 Main St, Anytown, USA' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.address).toBe('[REDACTED]');
    });

    it('should not mask non-PII fields', () => {
      const testData = { 
        email: 'user@example.com',
        department: 'Engineering',
        salary: 75000,
        startDate: '2020-01-01'
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe('***@***.***');
      expect(result.department).toBe('Engineering');
      expect(result.salary).toBe(75000);
      expect(result.startDate).toBe('2020-01-01');
    });
  });

  describe('Partial Masking Strategy', () => {
    beforeEach(() => {
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'partial';
    });

    it('should partially mask email addresses', () => {
      const testData = { email: 'user@example.com' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe('us***m@example.com');
    });

    it('should partially mask phone numbers', () => {
      const testData = { phone: '555-123-4567' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.phone).toBe('***-***-4567');
    });

    it('should partially mask SSN', () => {
      const testData = { ssn: '123-45-6789' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.ssn).toBe('***-**-6789');
    });

    it('should partially mask names', () => {
      const testData = { 
        firstName: 'John', 
        lastName: 'Doe',
        fullName: 'John Doe' 
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.firstName).toBe('J***n');
      expect(result.lastName).toBe('D***e');
      expect(result.fullName).toBe('J***e');
    });

    it('should partially mask addresses', () => {
      const testData = { address: '123 Main Street, Anytown, USA' };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.address).toBe('123 *** USA');
    });
  });

  describe('Hash Masking Strategy', () => {
    beforeEach(() => {
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'hash';
    });

    it('should hash PII fields with consistent prefixes', () => {
      const testData = { 
        email: 'user@example.com',
        phone: '555-123-4567' 
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toMatch(/^ema_[a-f0-9]{8}$/);
      expect(result.phone).toMatch(/^pho_[a-f0-9]{8}$/);
    });

    it('should produce consistent hashes for same input', () => {
      const testData = { email: 'user@example.com' };
      const result1 = piiMaskingService.maskData(testData, mockSecurityContext);
      const result2 = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result1.email).toBe(result2.email);
    });

    it('should produce different hashes for different inputs', () => {
      const testData1 = { email: 'user1@example.com' };
      const testData2 = { email: 'user2@example.com' };
      const result1 = piiMaskingService.maskData(testData1, mockSecurityContext);
      const result2 = piiMaskingService.maskData(testData2, mockSecurityContext);

      expect(result1.email).not.toBe(result2.email);
    });
  });

  describe('PII Access Permissions', () => {
    it('should not mask data for users with PII access', () => {
      mockSecurityContext.piiAccess = true;
      const testData = { 
        email: 'user@example.com',
        phone: '555-123-4567',
        name: 'John Doe'
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe('user@example.com');
      expect(result.phone).toBe('555-123-4567');
      expect(result.name).toBe('John Doe');
    });

    it('should mask data when PII masking is disabled in preset', () => {
      mockSecurityContext.preset.piiMasking.enabled = false;
      const testData = { 
        email: 'user@example.com',
        phone: '555-123-4567'
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe('user@example.com');
      expect(result.phone).toBe('555-123-4567');
    });
  });

  describe('Complex Data Structures', () => {
    it('should handle arrays of objects', () => {
      const testData = [
        { email: 'user1@example.com', name: 'John Doe' },
        { email: 'user2@example.com', name: 'Jane Smith' },
        { department: 'Engineering' } // Non-PII item
      ];
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result[0].email).toBe('***@***.***');
      expect(result[0].name).toBe('[REDACTED]');
      expect(result[1].email).toBe('***@***.***');
      expect(result[1].name).toBe('[REDACTED]');
      expect(result[2].department).toBe('Engineering');
    });

    it('should handle nested objects', () => {
      const testData = {
        user: {
          contact: {
            email: 'user@example.com',
            phone: '555-123-4567'
          },
          personal: {
            name: 'John Doe',
            ssn: '123-45-6789'
          }
        },
        department: 'Engineering'
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.user.contact.email).toBe('***@***.***');
      expect(result.user.contact.phone).toBe('***-***-****');
      expect(result.user.personal.name).toBe('[REDACTED]');
      expect(result.user.personal.ssn).toBe('***-**-****');
      expect(result.department).toBe('Engineering');
    });

    it('should handle mixed data types', () => {
      const testData = {
        emails: ['user1@example.com', 'user2@example.com'],
        count: 42,
        active: true,
        metadata: null,
        user: {
          email: 'admin@example.com',
          roles: ['admin', 'user']
        }
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(Array.isArray(result.emails)).toBe(true);
      result.emails.forEach((email: any) => {
        expect(email).toBe('***@***.***');
      });
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.metadata).toBe(null);
      expect(result.user.email).toBe('***@***.***');
      expect(result.user.roles).toEqual(['admin', 'user']);
    });
  });

  describe('Query Results Masking', () => {
    it('should mask query results', () => {
      const queryResults = [
        { 
          id: 1, 
          email: 'user1@example.com', 
          name: 'John Doe',
          department: 'Engineering'
        },
        { 
          id: 2, 
          email: 'user2@example.com', 
          name: 'Jane Smith',
          department: 'Sales'
        }
      ];
      const result = piiMaskingService.maskQueryResults(queryResults, mockSecurityContext);

      expect(result[0].email).toBe('***@***.***');
      expect(result[0].name).toBe('[REDACTED]');
      expect(result[0].department).toBe('Engineering');
      expect(result[1].email).toBe('***@***.***');
      expect(result[1].name).toBe('[REDACTED]');
      expect(result[1].department).toBe('Sales');
    });
  });

  describe('SQL Column Masking', () => {
    it('should generate masked column SQL for full masking', () => {
      const columns = ['id', 'email', 'name', 'department'];
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'full';
      
      const result = piiMaskingService.generateMaskedColumnsSQL(columns, mockSecurityContext);

      expect(result).toContain('id');
      expect(result).toContain("'[REDACTED]' AS email");
      expect(result).toContain("'[REDACTED]' AS name");
      expect(result).toContain('department');
    });

    it('should generate masked column SQL for partial masking', () => {
      const columns = ['id', 'email', 'phone', 'department'];
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'partial';
      
      const result = piiMaskingService.generateMaskedColumnsSQL(columns, mockSecurityContext);

      expect(result).toContain('id');
      expect(result).toContain('CASE');
      expect(result).toContain('SUBSTRING');
      expect(result).toContain('department');
    });

    it('should generate masked column SQL for hash masking', () => {
      const columns = ['id', 'email', 'name', 'department'];
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'hash';
      
      const result = piiMaskingService.generateMaskedColumnsSQL(columns, mockSecurityContext);

      expect(result).toContain('id');
      expect(result).toContain('SHA256');
      expect(result).toContain('department');
    });

    it('should not mask columns when PII access is granted', () => {
      const columns = ['id', 'email', 'name', 'department'];
      mockSecurityContext.piiAccess = true;
      
      const result = piiMaskingService.generateMaskedColumnsSQL(columns, mockSecurityContext);

      expect(result).toEqual(columns);
    });

    it('should not mask columns when masking is disabled', () => {
      const columns = ['id', 'email', 'name', 'department'];
      mockSecurityContext.preset.piiMasking.enabled = false;
      
      const result = piiMaskingService.generateMaskedColumnsSQL(columns, mockSecurityContext);

      expect(result).toEqual(columns);
    });
  });

  describe('PII Masking Validation', () => {
    it('should validate full masking effectiveness', () => {
      const originalData = { email: 'user@example.com', name: 'John Doe' };
      const maskedData = { email: '***@***.***', name: '[REDACTED]' };
      
      const isValid = piiMaskingService.validatePIIMasking(originalData, maskedData, mockSecurityContext);
      
      expect(isValid).toBe(true);
    });

    it('should validate partial masking effectiveness', () => {
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'partial';
      const originalData = { email: 'user@example.com', name: 'John Doe' };
      const maskedData = { email: 'us***m@example.com', name: 'J***e' };
      
      const isValid = piiMaskingService.validatePIIMasking(originalData, maskedData, mockSecurityContext);
      
      expect(isValid).toBe(true);
    });

    it('should validate hash masking effectiveness', () => {
      mockSecurityContext.preset.piiMasking.maskingStrategy = 'hash';
      const originalData = { email: 'user@example.com' };
      const maskedData = { email: 'ema_12345678' };
      
      const isValid = piiMaskingService.validatePIIMasking(originalData, maskedData, mockSecurityContext);
      
      expect(isValid).toBe(true);
    });

    it('should detect ineffective masking', () => {
      const originalData = { email: 'user@example.com' };
      const maskedData = { email: 'user@example.com' }; // Not masked
      
      const isValid = piiMaskingService.validatePIIMasking(originalData, maskedData, mockSecurityContext);
      
      expect(isValid).toBe(false);
    });

    it('should allow unchanged data when PII access is granted', () => {
      mockSecurityContext.piiAccess = true;
      const originalData = { email: 'user@example.com' };
      const maskedData = { email: 'user@example.com' };
      
      const isValid = piiMaskingService.validatePIIMasking(originalData, maskedData, mockSecurityContext);
      
      expect(isValid).toBe(true);
    });

    it('should allow unchanged data when masking is disabled', () => {
      mockSecurityContext.preset.piiMasking.enabled = false;
      const originalData = { email: 'user@example.com' };
      const maskedData = { email: 'user@example.com' };
      
      const isValid = piiMaskingService.validatePIIMasking(originalData, maskedData, mockSecurityContext);
      
      expect(isValid).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle null and undefined values', () => {
      const testData = {
        email: null,
        phone: undefined,
        name: 'John Doe'
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe(null);
      expect(result.phone).toBe(undefined);
      expect(result.name).toBe('[REDACTED]');
    });

    it('should handle empty strings', () => {
      const testData = {
        email: '',
        name: 'John Doe'
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe('');
      expect(result.name).toBe('[REDACTED]');
    });

    it('should handle non-string values in PII fields', () => {
      const testData = {
        email: 12345, // Number instead of string
        name: ['John', 'Doe'] // Array instead of string
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(result.email).toBe(12345);
      expect(result.name).toEqual(['John', 'Doe']);
    });

    it('should handle empty arrays and objects', () => {
      const testData = {
        users: [],
        metadata: {},
        email: 'user@example.com'
      };
      const result = piiMaskingService.maskData(testData, mockSecurityContext);

      expect(Array.isArray(result.users)).toBe(true);
      expect(result.users.length).toBe(0);
      expect(typeof result.metadata).toBe('object');
      expect(Object.keys(result.metadata).length).toBe(0);
      expect(result.email).toBe('***@***.***');
    });
  });
});
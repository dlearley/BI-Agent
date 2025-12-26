import { catalogService } from '../../services/catalog.service';
import { db } from '../../config/database';
import { PIIType, DiscoveryRequest, ProfileRequest } from '../../types';
import { mockAdminUser } from '../setup';

jest.mock('../../config/database');

describe('CatalogService', () => {
  const organizationId = 'test-org-1';
  const connectorId = 'postgres-connector-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('discoverSchema', () => {
    it('should discover PostgreSQL schema successfully', async () => {
      const mockConnector = {
        id: connectorId,
        organization_id: organizationId,
        type: 'postgresql',
        config: { host: 'localhost', port: 5432 },
      };

      const mockTables = [
        { table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE' },
        { table_schema: 'public', table_name: 'orders', table_type: 'BASE TABLE' },
      ];

      const mockUserColumns = [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', numeric_precision: null, numeric_scale: null },
        { column_name: 'email', data_type: 'varchar', is_nullable: 'NO', numeric_precision: null, numeric_scale: null },
        { column_name: 'name', data_type: 'varchar', is_nullable: 'YES', numeric_precision: null, numeric_scale: null },
      ];

      const mockOrderColumns = [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', numeric_precision: null, numeric_scale: null },
        { column_name: 'user_id', data_type: 'uuid', is_nullable: 'NO', numeric_precision: null, numeric_scale: null },
        { column_name: 'total', data_type: 'decimal', is_nullable: 'NO', numeric_precision: 10, numeric_scale: 2 },
      ];

      (db.queryOne as jest.Mock).mockResolvedValueOnce(mockConnector);
      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockTables)
        .mockResolvedValueOnce(mockUserColumns)
        .mockResolvedValueOnce(mockOrderColumns);

      const request: DiscoveryRequest = {
        connector_id: connectorId,
      };

      const result = await catalogService.discoverSchema(organizationId, request);

      expect(result).toHaveLength(2);
      expect(result[0].table_name).toBe('users');
      expect(result[0].columns).toHaveLength(3);
      expect(result[1].table_name).toBe('orders');
      expect(result[1].columns).toHaveLength(3);
    });

    it('should throw error when connector not found', async () => {
      (db.queryOne as jest.Mock).mockResolvedValueOnce(null);

      const request: DiscoveryRequest = {
        connector_id: 'non-existent-connector',
      };

      await expect(catalogService.discoverSchema(organizationId, request)).rejects.toThrow();
    });

    it('should filter tables by schema names', async () => {
      const mockConnector = {
        id: connectorId,
        organization_id: organizationId,
        type: 'postgresql',
        config: {},
      };

      const mockTables = [
        { table_schema: 'public', table_name: 'users', table_type: 'BASE TABLE' },
      ];

      const mockColumns = [
        { column_name: 'id', data_type: 'uuid', is_nullable: 'NO', numeric_precision: null, numeric_scale: null },
      ];

      (db.queryOne as jest.Mock).mockResolvedValueOnce(mockConnector);
      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockTables)
        .mockResolvedValueOnce(mockColumns);

      const request: DiscoveryRequest = {
        connector_id: connectorId,
        schema_names: ['public'],
      };

      await catalogService.discoverSchema(organizationId, request);

      const queryCall = (db.query as jest.Mock).mock.calls[0];
      expect(queryCall[1]).toContain('public');
    });
  });

  describe('profileDataset', () => {
    it('should profile a dataset with PII detection', async () => {
      const datasetId = 'dataset-1';
      const mockDataset = {
        id: datasetId,
        organization_id: organizationId,
        connector_id: connectorId,
        schema_name: 'public',
        table_name: 'customers',
        row_count: 0,
      };

      const mockColumns = [
        { id: 'col-1', column_name: 'id', column_type: 'uuid' },
        { id: 'col-2', column_name: 'email', column_type: 'varchar' },
        { id: 'col-3', column_name: 'phone', column_type: 'varchar' },
      ];

      const mockConnector = {
        id: connectorId,
        organization_id: organizationId,
        type: 'postgresql',
        config: {},
      };

      (db.queryOne as jest.Mock)
        .mockResolvedValueOnce(mockDataset)
        .mockResolvedValueOnce(mockConnector)
        .mockResolvedValueOnce(mockDataset);

      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockColumns)
        .mockResolvedValueOnce([{ count: 100 }])
        .mockResolvedValueOnce([
          { null_count: 0, distinct_count: 100, min_value: null, max_value: null, avg_value: null },
          { null_count: 5, distinct_count: 95, min_value: 'a@test.com', max_value: 'z@test.com', avg_value: null },
          { null_count: 10, distinct_count: 90, min_value: '123-456-7890', max_value: '999-999-9999', avg_value: null },
        ]);

      const result = await catalogService.profileDataset(organizationId, datasetId, true);

      expect(result.id).toBe(datasetId);
      expect((db.query as jest.Mock).mock.calls.some(call => call[0].includes('UPDATE columns'))).toBeTruthy();
    });
  });

  describe('detectPII', () => {
    it('should detect email PII by column name', () => {
      const result = catalogService.detectPII('email_address', 'varchar', []);

      expect(result.is_pii).toBe(true);
      expect(result.pii_type).toBe(PIIType.EMAIL);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect email PII by value patterns', () => {
      const result = catalogService.detectPII('contact', 'varchar', ['user@example.com', 'admin@test.com']);

      expect(result.is_pii).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should detect phone PII', () => {
      const result = catalogService.detectPII('phone_number', 'varchar', []);

      expect(result.is_pii).toBe(true);
      expect(result.pii_type).toBe(PIIType.PHONE);
    });

    it('should detect SSN PII by pattern', () => {
      const result = catalogService.detectPII('ssn', 'varchar', ['123-45-6789', '987-65-4321']);

      expect(result.is_pii).toBe(true);
      expect(result.pii_type).toBe(PIIType.SSN);
    });

    it('should detect credit card PII', () => {
      const result = catalogService.detectPII('card_number', 'varchar', ['4532-1234-5678-9010']);

      expect(result.is_pii).toBe(true);
      expect(result.pii_type).toBe(PIIType.CREDIT_CARD);
    });

    it('should not detect PII for non-sensitive columns', () => {
      const result = catalogService.detectPII('order_id', 'uuid', ['123', '456']);

      expect(result.is_pii).toBe(false);
    });

    it('should detect name PII', () => {
      const result = catalogService.detectPII('name', 'varchar', []);

      expect(result.is_pii).toBe(true);
      expect(result.pii_type).toBe(PIIType.NAME);
    });

    it('should detect health ID PII', () => {
      const result = catalogService.detectPII('patient_id', 'varchar', []);

      expect(result.is_pii).toBe(true);
      expect(result.pii_type).toBe(PIIType.HEALTH_ID);
    });

    it('should detect date of birth PII by pattern', () => {
      const result = catalogService.detectPII('dob', 'varchar', ['1990-01-15', '1985-12-25']);

      expect(result.is_pii).toBe(true);
      expect(result.pii_type).toBe(PIIType.DATE_OF_BIRTH);
    });
  });

  describe('getDatasets', () => {
    it('should return datasets with pagination', async () => {
      const mockDatasets = [
        {
          id: 'dataset-1',
          organization_id: organizationId,
          connector_id: connectorId,
          name: 'customers',
          table_name: 'customers',
          row_count: 1000,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      (db.queryOne as jest.Mock).mockResolvedValueOnce({ count: 1 });
      (db.query as jest.Mock).mockResolvedValueOnce(mockDatasets);

      const result = await catalogService.getDatasets(organizationId, 100, 0);

      expect(result.datasets).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe('computeFreshness', () => {
    it('should compute freshness info for datasets', async () => {
      const mockDatasets = [
        {
          id: 'dataset-1',
          table_name: 'customers',
          freshness_sla_hours: 24,
          last_profiled_at: new Date(Date.now() - 10 * 60 * 60 * 1000), // 10 hours ago
          created_at: new Date(),
        },
        {
          id: 'dataset-2',
          table_name: 'orders',
          freshness_sla_hours: 6,
          last_profiled_at: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          created_at: new Date(),
        },
      ];

      (db.query as jest.Mock).mockResolvedValueOnce(mockDatasets);

      const result = await catalogService.computeFreshness(organizationId);

      expect(result).toHaveLength(2);
      expect(result[0].is_fresh).toBe(true); // 10 hours < 24 hours SLA
      expect(result[1].is_fresh).toBe(false); // 12 hours > 6 hours SLA
    });
  });

  describe('getLineage', () => {
    it('should return upstream and downstream lineage', async () => {
      const columnId = 'col-1';
      const mockUpstream = [
        {
          id: 'lineage-1',
          organization_id: organizationId,
          source_column_id: 'col-0',
          target_column_id: columnId,
          source_table: 'raw_users',
          target_table: 'users',
          lineage_type: 'upstream',
        },
      ];

      const mockDownstream = [
        {
          id: 'lineage-2',
          organization_id: organizationId,
          source_column_id: columnId,
          target_column_id: 'col-2',
          source_table: 'users',
          target_table: 'user_summary',
          lineage_type: 'downstream',
        },
      ];

      (db.query as jest.Mock)
        .mockResolvedValueOnce(mockUpstream)
        .mockResolvedValueOnce(mockDownstream);

      const result = await catalogService.getLineage(organizationId, columnId);

      expect(result.upstream).toHaveLength(1);
      expect(result.downstream).toHaveLength(1);
      expect(result.upstream[0].source_table).toBe('raw_users');
      expect(result.downstream[0].target_table).toBe('user_summary');
    });
  });
});
